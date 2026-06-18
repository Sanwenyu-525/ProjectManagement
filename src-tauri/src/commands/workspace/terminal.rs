use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
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

// ── UTF-8 stream decoding helper (uses encoding_rs) ─────────────────────

/// Decode a raw byte chunk from a stream into a String, correctly handling
/// multi-byte UTF-8 characters that may be split across read() calls.
/// `decoder` maintains state between calls for streaming decode.
/// `remnant` carries incomplete trailing bytes between calls.
fn decode_stream_chunk(
    decoder: &mut encoding_rs::Decoder,
    remnant: &mut Vec<u8>,
    buf: &[u8],
) -> String {
    let mut combined = std::mem::take(remnant);
    combined.extend_from_slice(buf);

    let mut output = String::with_capacity(combined.len());
    let (_result, read_pos, _had_errors) =
        decoder.decode_to_string(&combined, &mut output, false);

    // Save unconsumed bytes for the next call
    if read_pos < combined.len() {
        *remnant = combined[read_pos..].to_vec();
    }

    output
}

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

// ── Helper: spawn output reader thread ───────────────────────────────────

fn spawn_output_reader(
    reader: Box<dyn Read + Send>,
    app: AppHandle,
    terminal_id: String,
) {
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut decoder = encoding_rs::UTF_8.new_decoder();
        let mut buf = [0u8; 8192];
        let mut remnant: Vec<u8> = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = decode_stream_chunk(&mut decoder, &mut remnant, &buf[..n]);
                    let _ = app.emit(
                        "terminal-output",
                        TerminalOutput {
                            terminal_id: terminal_id.clone(),
                            data,
                            stream: "stdout".into(),
                        },
                    );
                }
            }
        }
    });
}

// ── Non-interactive command ──────────────────────────────────────────────

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

    // Spawn output readers
    if let Some(stdout) = stdout {
        spawn_output_reader(Box::new(stdout), app.clone(), terminal_id.clone());
    }
    if let Some(stderr) = stderr {
        spawn_output_reader(Box::new(stderr), app.clone(), terminal_id.clone());
    }

    // Register process in registry
    {
        let mut procs = recover_lock(&PROCESSES);
        procs.insert(terminal_id.clone(), child);
    }

    // Exit watcher thread (polling with try_wait, keeps registry entry alive
    // so terminal_stop/input can still reach the process while running)
    let app_exit = app.clone();
    let tid_exit = terminal_id.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let exited = {
                let mut procs = recover_lock(&PROCESSES);
                match procs.get_mut(&tid_exit) {
                    Some(child) => child.try_wait().ok().flatten().is_some(),
                    None => break,
                }
            };
            if !exited {
                continue;
            }
            let code = {
                let mut procs = recover_lock(&PROCESSES);
                procs.remove(&tid_exit).and_then(|mut c| {
                    c.try_wait().ok().flatten().and_then(|s| s.code())
                })
            };
            let _ = app_exit.emit(
                "terminal-exit",
                TerminalExit {
                    terminal_id: tid_exit.clone(),
                    code,
                },
            );
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

    // Build the shell command.
    // On Windows, route through cmd.exe /C to set codepage to UTF-8 (65001)
    // before starting the shell, preventing GBK vs UTF-8 encoding mismatch.
    #[cfg(target_os = "windows")]
    let cmd_builder = {
        let mut shell_cmd = String::from("chcp 65001 >nul 2>&1 & ");
        shell_cmd.push_str(&shell);
        if let Some(ref shell_args) = args {
            for arg in shell_args {
                shell_cmd.push(' ');
                shell_cmd.push_str(arg);
            }
        }
        let mut c = CommandBuilder::new("cmd.exe");
        c.arg("/C");
        c.arg(&shell_cmd);
        c.cwd(&cwd);
        c.env("TERM", "xterm-256color");
        c.env("FORCE_COLOR", "1");
        c.env("COLORTERM", "truecolor");
        c.env("PYTHONIOENCODING", "utf-8");
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd_builder = {
        let mut c = CommandBuilder::new(&shell);
        if let Some(ref shell_args) = args {
            for arg in shell_args {
                c.arg(arg);
            }
        }
        c.cwd(&cwd);
        c.env("TERM", "xterm-256color");
        c.env("FORCE_COLOR", "1");
        c.env("COLORTERM", "truecolor");
        c
    };

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

    // Output reader thread (with UTF-8 remnant handling for CJK characters)
    spawn_output_reader(reader, app.clone(), terminal_id.clone());

    // Exit watcher thread (polling with try_wait, keeps registry entry alive)
    let app_exit = app.clone();
    let tid_exit = terminal_id.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let exited = {
                let mut terminals = recover_lock(&PTY_TERMINALS);
                match terminals.get_mut(&tid_exit) {
                    Some(terminal) => terminal.child.try_wait().ok().flatten().is_some(),
                    None => break,
                }
            };
            if !exited {
                continue;
            }
            let code = {
                let mut terminals = recover_lock(&PTY_TERMINALS);
                terminals.remove(&tid_exit).and_then(|mut t| {
                    t.child.try_wait().ok().flatten().map(|s| s.exit_code() as i32)
                })
            };
            let _ = app_exit.emit(
                "terminal-exit",
                TerminalExit {
                    terminal_id: tid_exit.clone(),
                    code,
                },
            );
            break;
        }
    });

    Ok(terminal_id)
}

// ── Start agent directly in PTY (no shell wrapper) ───────────────────────

#[command]
pub async fn terminal_start_agent(
    app: AppHandle,
    terminal_id: String,
    command: String,
    args: Vec<String>,
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

    // Spawn the agent command. On Windows, npm-installed CLIs (like `claude`)
    // are `.cmd` scripts that portable_pty can't exec directly — always route
    // through cmd.exe /C which handles both .cmd/.bat scripts and .exe files.
    // Also set codepage to UTF-8 (65001) to prevent GBK encoding mismatch.
    #[cfg(target_os = "windows")]
    let mut cmd_builder = {
        let mut c = CommandBuilder::new("cmd.exe");
        c.arg("/C");
        c.arg("chcp 65001 >nul 2>&1 &");
        // .cjs files have no default handler on Windows — invoke via node explicitly
        if command.ends_with(".cjs") || command.ends_with(".mjs") {
            c.arg("node");
        }
        c.arg(&command);
        for arg in &args {
            c.arg(arg);
        }
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd_builder = {
        let mut c = CommandBuilder::new(&command);
        for arg in &args {
            c.arg(arg);
        }
        c
    };

    cmd_builder.cwd(&cwd);
    cmd_builder.env("TERM", "xterm-256color");
    cmd_builder.env("FORCE_COLOR", "1");
    cmd_builder.env("COLORTERM", "truecolor");

    let child = pair
        .slave
        .spawn_command(cmd_builder)
        .map_err(|e| format!("启动智能体失败: {} (命令: {})", e, command))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("获取 PTY writer 失败: {}", e))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("获取 PTY reader 失败: {}", e))?;

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

    // Output reader thread (with UTF-8 remnant handling for CJK characters)
    spawn_output_reader(reader, app.clone(), terminal_id.clone());

    // Exit watcher thread (polling with try_wait, keeps registry entry alive
    // so terminal_stop/input/resize can still reach the process while running)
    let app_exit = app.clone();
    let tid_exit = terminal_id.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let exited = {
                let mut terminals = recover_lock(&PTY_TERMINALS);
                match terminals.get_mut(&tid_exit) {
                    Some(terminal) => terminal.child.try_wait().ok().flatten().is_some(),
                    None => break, // removed externally (e.g. terminal_stop)
                }
            };
            if !exited {
                continue;
            }
            // Process exited — remove from registry and emit exit event
            let code = {
                let mut terminals = recover_lock(&PTY_TERMINALS);
                terminals.remove(&tid_exit).and_then(|mut t| {
                    t.child.try_wait().ok().flatten().map(|s| s.exit_code() as i32)
                })
            };
            let _ = app_exit.emit(
                "terminal-exit",
                TerminalExit {
                    terminal_id: tid_exit.clone(),
                    code,
                },
            );
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
