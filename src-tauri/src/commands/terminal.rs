use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{command, AppHandle, Emitter};

use portable_pty::{CommandBuilder, PtySize, native_pty_system};

// Recover from mutex poisoning (other threads panicked while holding the lock)
fn recover_lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

// ── Process registry (non-interactive commands) ──────────────────────────

static PROCESSES: std::sync::LazyLock<Mutex<HashMap<String, Child>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

// ── PTY registry (interactive shells) ────────────────────────────────────

struct PtyTerminal {
    child: Box<dyn portable_pty::Child + Send + Sync>,
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
}

static PTY_TERMINALS: std::sync::LazyLock<Mutex<HashMap<String, PtyTerminal>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

// ── Event payloads ───────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput {
    terminal_id: String,
    data: String,
    stream: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExit {
    terminal_id: String,
    code: Option<i32>,
}

// ── Non-interactive command (unchanged) ──────────────────────────────────

#[command]
pub async fn terminal_start(
    app: AppHandle,
    project_id: String,
    command_str: String,
    cwd: String,
) -> Result<String, String> {
    let terminal_id = format!(
        "{}-{}",
        project_id,
        &uuid::Uuid::new_v4().to_string()[..8]
    );

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("cmd");
        c.args(["/C", "chcp 65001 >nul &", &command_str]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = Command::new("sh");
        c.args(["-c", &command_str]);
        c
    };

    cmd.current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped())
        .env("FORCE_COLOR", "1")
        .env("TERM", "xterm-256color")
        .env("COLORTERM", "truecolor");

    let mut child = cmd.spawn().map_err(|e| format!("启动失败: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
        let mut procs = recover_lock(&PROCESSES);
        procs.insert(terminal_id.clone(), child);
    }

    let app_out = app.clone();
    let tid_out = terminal_id.clone();
    std::thread::spawn(move || {
        if let Some(stdout) = stdout {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        let _ = app_out.emit(
                            "terminal-output",
                            TerminalOutput {
                                terminal_id: tid_out.clone(),
                                data: line.clone(),
                                stream: "stdout".into(),
                            },
                        );
                    }
                }
            }
        }
    });

    let app_err = app.clone();
    let tid_err = terminal_id.clone();
    std::thread::spawn(move || {
        if let Some(stderr) = stderr {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        let _ = app_err.emit(
                            "terminal-output",
                            TerminalOutput {
                                terminal_id: tid_err.clone(),
                                data: line.clone(),
                                stream: "stderr".into(),
                            },
                        );
                    }
                }
            }
        }
    });

    let app_exit = app.clone();
    let tid_exit = terminal_id.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let mut procs = match PROCESSES.lock() {
            Ok(p) => p,
            Err(e) => e.into_inner(),
        };
        if let Some(child) = procs.get_mut(&tid_exit) {
            match child.try_wait() {
                Ok(Some(status)) => {
                    let _ = app_exit.emit(
                        "terminal-exit",
                        TerminalExit {
                            terminal_id: tid_exit.clone(),
                            code: status.code(),
                        },
                    );
                    procs.remove(&tid_exit);
                    break;
                }
                Ok(None) => {}
                Err(_) => {
                    procs.remove(&tid_exit);
                    break;
                }
            }
        } else {
            break;
        }
    });

    Ok(terminal_id)
}

// ── Interactive shell via PTY ────────────────────────────────────────────

#[command]
pub async fn terminal_start_shell(
    app: AppHandle,
    terminal_id: String,
    shell: String,
    args: Option<Vec<String>>,
    cwd: String,
) -> Result<String, String> {
    let pty_system = native_pty_system();

    let size = PtySize {
        rows: 24,
        cols: 120,
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("创建 PTY 失败: {}", e))?;

    // Build the shell command
    let mut cmd_builder = CommandBuilder::new(&shell);
    if let Some(ref shell_args) = args {
        for arg in shell_args {
            cmd_builder.arg(arg);
        }
    }
    cmd_builder.cwd(&cwd);
    cmd_builder.env("TERM", "xterm-256color");
    cmd_builder.env("FORCE_COLOR", "1");
    cmd_builder.env("COLORTERM", "truecolor");

    // Spawn the shell on the PTY slave
    let child = pair
        .slave
        .spawn_command(cmd_builder)
        .map_err(|e| format!("启动 shell 失败: {}", e))?;

    // Take writer for sending input
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("获取 PTY writer 失败: {}", e))?;

    // Clone reader for receiving output
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("获取 PTY reader 失败: {}", e))?;

    // Store PTY terminal (child + writer + master for resize)
    {
        let mut terminals = recover_lock(&PTY_TERMINALS);
        terminals.insert(
            terminal_id.clone(),
            PtyTerminal {
                child,
                writer,
                master: pair.master,
            },
        );
    }

    // Output reader thread
    let app_out = app.clone();
    let tid_out = terminal_id.clone();
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_out.emit(
                        "terminal-output",
                        TerminalOutput {
                            terminal_id: tid_out.clone(),
                            data,
                            stream: "stdout".into(),
                        },
                    );
                }
            }
        }
    });

    // Exit watcher thread
    let app_exit = app.clone();
    let tid_exit = terminal_id.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let mut terminals = match PTY_TERMINALS.lock() {
            Ok(t) => t,
            Err(e) => e.into_inner(),
        };
        if let Some(terminal) = terminals.get_mut(&tid_exit) {
            match terminal.child.try_wait() {
                Ok(Some(status)) => {
                    let code = status.exit_code();
                    let _ = app_exit.emit(
                        "terminal-exit",
                        TerminalExit {
                            terminal_id: tid_exit.clone(),
                            code: if code == 0 { Some(0) } else { Some(code as i32) },
                        },
                    );
                    terminals.remove(&tid_exit);
                    break;
                }
                Ok(None) => {}
                Err(_) => {
                    terminals.remove(&tid_exit);
                    break;
                }
            }
        } else {
            break;
        }
    });

    Ok(terminal_id)
}

// ── Input (works for both piped and PTY) ─────────────────────────────────

#[command]
pub async fn terminal_input(terminal_id: String, data: String) -> Result<(), String> {
    // Try PTY terminal first
    {
        let mut terminals = recover_lock(&PTY_TERMINALS);
        if let Some(terminal) = terminals.get_mut(&terminal_id) {
            terminal
                .writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("写入失败: {}", e))?;
            terminal
                .writer
                .flush()
                .map_err(|e| format!("刷新失败: {}", e))?;
            return Ok(());
        }
    }

    // Fall back to piped process
    {
        let mut procs = recover_lock(&PROCESSES);
        if let Some(child) = procs.get_mut(&terminal_id) {
            if let Some(ref mut stdin) = child.stdin {
                stdin
                    .write_all(data.as_bytes())
                    .map_err(|e| format!("写入失败: {}", e))?;
                stdin.flush().map_err(|e| format!("刷新失败: {}", e))?;
                return Ok(());
            } else {
                return Err("stdin 不可用".into());
            }
        }
    }

    Err("进程不存在".into())
}

// ── Stop (works for both piped and PTY) ──────────────────────────────────

#[command]
pub async fn terminal_stop(terminal_id: String) -> Result<(), String> {
    // Try PTY terminal first
    {
        let mut terminals = recover_lock(&PTY_TERMINALS);
        if let Some(mut terminal) = terminals.remove(&terminal_id) {
            terminal
                .child
                .kill()
                .map_err(|e| format!("停止失败: {}", e))?;
            return Ok(());
        }
    }

    // Fall back to piped process
    {
        let mut procs = recover_lock(&PROCESSES);
        if let Some(mut child) = procs.remove(&terminal_id) {
            child.kill().map_err(|e| format!("停止失败: {}", e))?;
            return Ok(());
        }
    }

    Err("进程不存在或已退出".into())
}

// ── Resize PTY ───────────────────────────────────────────────────────────

#[command]
pub async fn terminal_resize(
    terminal_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut terminals = recover_lock(&PTY_TERMINALS);
    if let Some(terminal) = terminals.get_mut(&terminal_id) {
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        terminal
            .master
            .resize(size)
            .map_err(|e| format!("调整终端大小失败: {}", e))?;
        return Ok(());
    }
    Err("进程不存在".into())
}

// ── Get terminal IDs for a project ─────────────────────────────────────

pub fn get_terminal_ids_for_project(project_id: &str) -> Vec<String> {
    let prefix = format!("{}-", project_id);
    let mut ids = Vec::new();

    if let Ok(procs) = PROCESSES.lock() {
        for key in procs.keys() {
            if key.starts_with(&prefix) {
                ids.push(key.clone());
            }
        }
    }
    if let Ok(terminals) = PTY_TERMINALS.lock() {
        for key in terminals.keys() {
            if key.starts_with(&prefix) && !ids.contains(key) {
                ids.push(key.clone());
            }
        }
    }
    ids
}

// ── Cleanup on app shutdown ──────────────────────────────────────────────

pub fn cleanup_all() {
    if let Ok(mut procs) = PROCESSES.lock() {
        for (_, mut child) in procs.drain() {
            child.kill().ok();
        }
    }
    if let Ok(mut terminals) = PTY_TERMINALS.lock() {
        for (_, mut terminal) in terminals.drain() {
            terminal.child.kill().ok();
        }
    }
}
