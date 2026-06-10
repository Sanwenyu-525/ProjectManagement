use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{command, AppHandle, Emitter};

// Global process registry
static PROCESSES: std::sync::LazyLock<Mutex<HashMap<String, Child>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

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

    // Take stdout/stderr handles before storing child
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Store child process
    {
        let mut procs = PROCESSES.lock().map_err(|e| e.to_string())?;
        procs.insert(terminal_id.clone(), child);
    }

    // Stdout reader thread
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

    // Stderr reader thread
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

    // Exit watcher thread
    let app_exit = app.clone();
    let tid_exit = terminal_id.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let mut procs = match PROCESSES.lock() {
            Ok(p) => p,
            Err(_) => break,
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

#[command]
pub async fn terminal_stop(terminal_id: String) -> Result<(), String> {
    let mut procs = PROCESSES.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = procs.remove(&terminal_id) {
        child.kill().map_err(|e| format!("停止失败: {}", e))?;
        Ok(())
    } else {
        Err("进程不存在或已退出".into())
    }
}

#[command]
pub async fn terminal_input(terminal_id: String, data: String) -> Result<(), String> {
    let mut procs = PROCESSES.lock().map_err(|e| e.to_string())?;
    if let Some(child) = procs.get_mut(&terminal_id) {
        if let Some(ref mut stdin) = child.stdin {
            stdin
                .write_all(data.as_bytes())
                .map_err(|e| format!("写入失败: {}", e))?;
            stdin.flush().map_err(|e| format!("刷新失败: {}", e))?;
            Ok(())
        } else {
            Err("stdin 不可用".into())
        }
    } else {
        Err("进程不存在".into())
    }
}

/// Start an interactive shell (no cmd /C wrapper). Output is read byte-by-byte
/// so interactive prompts and partial lines appear immediately.
#[command]
pub async fn terminal_start_shell(
    app: AppHandle,
    terminal_id: String,
    shell: String,
    cwd: String,
) -> Result<String, String> {
    let mut cmd = Command::new(&shell);
    cmd.current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        cmd.env("TERM", "xterm-256color");
        cmd.env("PYTHONUTF8", "1");
        cmd.env("PYTHONIOENCODING", "utf-8");
        // Force child process console to use UTF-8 codepage
        use std::os::windows::process::CommandExt;
        const CREATE_UNICODE_ENVIRONMENT: u32 = 0x00000400;
        cmd.creation_flags(CREATE_UNICODE_ENVIRONMENT);
        // If launching PowerShell, force UTF-8 console encoding before profile loads
        let shell_lower = shell.to_lowercase();
        if shell_lower.contains("powershell") {
            cmd.args([
                "-NoExit", "-Command",
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8"
            ]);
        }
    }

    let mut child = cmd.spawn().map_err(|e| format!("启动 shell 失败: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
        let mut procs = PROCESSES.lock().map_err(|e| e.to_string())?;
        procs.insert(terminal_id.clone(), child);
    }

    // Stdout reader — byte by byte for interactive responsiveness
    let app_out = app.clone();
    let tid_out = terminal_id.clone();
    std::thread::spawn(move || {
        if let Some(stdout) = stdout {
            let mut reader = stdout;
            let mut buf = [0u8; 1024];
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
        }
    });

    // Stderr reader — byte by byte
    let app_err = app.clone();
    let tid_err = terminal_id.clone();
    std::thread::spawn(move || {
        if let Some(stderr) = stderr {
            let mut reader = stderr;
            let mut buf = [0u8; 1024];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_err.emit(
                            "terminal-output",
                            TerminalOutput {
                                terminal_id: tid_err.clone(),
                                data,
                                stream: "stderr".into(),
                            },
                        );
                    }
                }
            }
        }
    });

    // Exit watcher
    let app_exit = app.clone();
    let tid_exit = terminal_id.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let mut procs = match PROCESSES.lock() {
            Ok(p) => p,
            Err(_) => break,
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
