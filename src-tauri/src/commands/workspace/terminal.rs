use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};

use crate::path_guard;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{command, AppHandle, Emitter, State};

use crate::db::Database;
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use regex::Regex;

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
    writer: Option<Box<dyn Write + Send>>,
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

// ── Resolve claude CLI to its .exe path (Windows only) ─────────────────

/// Resolve a CLI command name (like "claude") to its .exe path.
/// npm installs create `claude` (shell script), `claude.cmd`, and the actual
/// `claude.exe` lives in `node_modules/@anthropic-ai/claude-code/bin/`.
/// We need the .exe for direct PTY spawning (bypassing cmd.exe).
#[cfg(target_os = "windows")]
fn resolve_claude_exe(command: &str) -> Result<String, String> {
    // If the command is already an absolute .exe path, use it directly
    if command.ends_with(".exe") && std::path::Path::new(command).exists() {
        return Ok(command.to_string());
    }

    // Try `where` to find the command in PATH
    if let Ok(output) = std::process::Command::new("cmd")
        .args(["/C", "where", &format!("{}.exe", command)])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(first_line) = stdout.lines().next() {
            let path = first_line.trim();
            if !path.is_empty() && std::path::Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
    }

    // Fallback: check the same directory as the command (npm puts claude,
    // claude.cmd, and the .exe in the same bin directory or nearby node_modules)
    if let Some(parent) = std::path::Path::new(command).parent() {
        if !parent.as_os_str().is_empty() {
            let candidate = parent.join("claude.exe");
            if candidate.exists() {
                return Ok(candidate.to_string_lossy().to_string());
            }
            let candidate = parent.join("node_modules").join("@anthropic-ai")
                .join("claude-code").join("bin").join("claude.exe");
            if candidate.exists() {
                return Ok(candidate.to_string_lossy().to_string());
            }
        }
    }

    // Fallback: resolve command via PATH using `where`, then check siblings
    if let Ok(output) = std::process::Command::new("cmd")
        .args(["/C", "where", command])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(first_line) = stdout.lines().next() {
            let path = first_line.trim();
            if let Some(parent) = std::path::Path::new(path).parent() {
                let candidate = parent.join("node_modules").join("@anthropic-ai")
                    .join("claude-code").join("bin").join("claude.exe");
                if candidate.exists() {
                    return Ok(candidate.to_string_lossy().to_string());
                }
            }
        }
    }

    // Fallback: try common npm global install locations
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let candidate = std::path::PathBuf::from(&appdata)
            .join("npm")
            .join("node_modules")
            .join("@anthropic-ai")
            .join("claude-code")
            .join("bin")
            .join("claude.exe");
        if candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
    }

    Err(format!("无法找到 {}.exe，请确保 claude 已正确安装", command))
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
    stream: &str,
) {
    let stream = stream.to_string();
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
                            stream: stream.clone(),
                        },
                    );
                }
            }
        }
    });
}

/// PTY 退出监听线程（共享实现，消除 3 处重复代码）
fn spawn_pty_exit_watcher(app: AppHandle, terminal_id: String) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let mut terminals = recover_lock(&PTY_TERMINALS);
            match terminals.get_mut(&terminal_id) {
                Some(terminal) => {
                    if let Ok(Some(status)) = terminal.child.try_wait() {
                        let code = status.exit_code() as i32;
                        drop(terminals);
                        let _ = app.emit(
                            "terminal-exit",
                            TerminalExit {
                                terminal_id: terminal_id.clone(),
                                code: Some(code),
                            },
                        );
                        let mut terminals = recover_lock(&PTY_TERMINALS);
                        terminals.remove(&terminal_id);
                        break;
                    }
                }
                None => break,
            }
        }
    });
}

/// 非 PTY 进程退出监听线程
fn spawn_process_exit_watcher(app: AppHandle, terminal_id: String) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let exited = {
                let mut procs = recover_lock(&PROCESSES);
                match procs.get_mut(&terminal_id) {
                    Some(child) => child.try_wait().ok().flatten().is_some(),
                    None => break,
                }
            };
            if !exited {
                continue;
            }
            let code = {
                let mut procs = recover_lock(&PROCESSES);
                procs.remove(&terminal_id).and_then(|mut c| {
                    c.try_wait().ok().flatten().and_then(|s| s.code())
                })
            };
            let _ = app.emit(
                "terminal-exit",
                TerminalExit {
                    terminal_id: terminal_id.clone(),
                    code,
                },
            );
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
        spawn_output_reader(Box::new(stdout), app.clone(), terminal_id.clone(), "stdout");
    }
    if let Some(stderr) = stderr {
        spawn_output_reader(Box::new(stderr), app.clone(), terminal_id.clone(), "stderr");
    }

    // Register process in registry
    {
        let mut procs = recover_lock(&PROCESSES);
        procs.insert(terminal_id.clone(), child);
    }

    spawn_process_exit_watcher(app.clone(), terminal_id.clone());

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
    // 校验 cwd 存在性，避免使用已删除的路径启动终端
    path_guard::validate_path_exists(&cwd)?;

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
                writer: Some(writer),
                master: pair.master,
            },
        );
    }

    // Output reader thread (with UTF-8 remnant handling for CJK characters)
    spawn_output_reader(reader, app.clone(), terminal_id.clone(), "stdout");

    spawn_pty_exit_watcher(app.clone(), terminal_id.clone());

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
    // are `.cmd` scripts — route through cmd.exe /C which handles .cmd/.bat/.exe.
    // NOTE: do NOT chain `chcp 65001` with "&" here — portable_pty quotes each
    // arg containing spaces, wrapping "&" in quotes and breaking command parsing.
    #[cfg(target_os = "windows")]
    let mut cmd_builder = {
        let mut c = CommandBuilder::new("cmd.exe");
        c.arg("/C");
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
                writer: Some(writer),
                master: pair.master,
            },
        );
    }

    // Agent output reader: forward raw PTY output to xterm
    spawn_output_reader(reader, app.clone(), terminal_id.clone(), "stdout");

    spawn_pty_exit_watcher(app.clone(), terminal_id.clone());

    Ok(terminal_id)
}

// ── Start agent in piped mode (non-PTY, for one-shot -p mode) ───────────

/// Spawn an agent command with piped stdin/stdout. The `stdin_data` is written
/// to the child's stdin and then stdin is closed, signaling EOF. Output is
/// emitted as terminal-output events just like PTY-based terminals.
///
/// This avoids cmd.exe argument mangling issues with special characters
/// (angle brackets, ampersands, etc.) by passing the prompt via stdin instead
/// of command-line arguments.
#[command]
pub async fn terminal_start_agent_piped(
    app: AppHandle,
    terminal_id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    stdin_data: String,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("cmd");
        let mut shell_cmd = String::new();
        if command.ends_with(".cjs") || command.ends_with(".mjs") {
            shell_cmd.push_str("node ");
        }
        shell_cmd.push_str(&command);
        for arg in &args {
            shell_cmd.push(' ');
            // Quote args that contain spaces
            if arg.contains(' ') {
                shell_cmd.push('"');
                shell_cmd.push_str(arg);
                shell_cmd.push('"');
            } else {
                shell_cmd.push_str(arg);
            }
        }
        c.args(["/C", &shell_cmd]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = Command::new(&command);
        for arg in &args {
            c.arg(arg);
        }
        c
    };

    cmd.current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped())
        .env("FORCE_COLOR", "0")
        .env("NO_COLOR", "1")
        .env("TERM", "dumb");

    let mut child = cmd.spawn().map_err(|e| format!("启动智能体失败: {} (命令: {})", e, command))?;

    // Write stdin_data and close stdin to signal EOF
    if let Some(mut stdin) = child.stdin.take() {
        let data = stdin_data;
        std::thread::spawn(move || {
            let _ = stdin.write_all(data.as_bytes());
            let _ = stdin.flush();
            // stdin is dropped here, closing the pipe (EOF)
        });
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Some(stdout) = stdout {
        spawn_output_reader(Box::new(stdout), app.clone(), terminal_id.clone(), "stdout");
    }
    if let Some(stderr) = stderr {
        spawn_output_reader(Box::new(stderr), app.clone(), terminal_id.clone(), "stderr");
    }

    // Register process
    {
        let mut procs = recover_lock(&PROCESSES);
        procs.insert(terminal_id.clone(), child);
    }

    // Exit watcher
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
            break;
        }
    });

    Ok(terminal_id)
}

// ── Start agent via PTY with stdin_data (streaming-friendly one-shot) ───

/// Like `terminal_start_agent_piped` but uses a PTY instead of pipes.
/// This gives the child process line-buffered stdout (instead of block-buffered),
/// enabling real-time streaming of `--output-format stream-json` output.
/// The `stdin_data` is written to the PTY writer and then dropped to signal EOF.
#[command]
pub async fn terminal_start_agent_piped_pty(
    app: AppHandle,
    terminal_id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    stdin_data: String,
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

    // On Windows, cmd.exe + batch file + stdin redirection is unreliable in ConPTY
    // (the PTY implementation used by portable_pty on Windows). Instead, resolve
    // the claude CLI to its .exe path and spawn it directly, piping the prompt
    // through PTY stdin. This avoids cmd.exe entirely.
    #[cfg(target_os = "windows")]
    let mut cmd_builder = {
        // Resolve claude to claude.exe — npm creates both `claude` (shell script)
        // and `claude.cmd` in the same directory, and `claude.exe` lives inside
        // node_modules. Try `where` first, then fall back to common npm paths.
        let claude_exe = resolve_claude_exe(&command)
            .map_err(|e| format!("找不到 claude 可执行文件: {}", e))?;
        let mut c = CommandBuilder::new(&claude_exe);
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
    cmd_builder.env("TERM", "dumb");
    cmd_builder.env("FORCE_COLOR", "0");
    cmd_builder.env("NO_COLOR", "1");

    let child = pair
        .slave
        .spawn_command(cmd_builder)
        .map_err(|e| format!("启动智能体失败: {} (命令: {})", e, command))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("获取 PTY reader 失败: {}", e))?;

    // Write prompt to PTY stdin then close (signals EOF).
    // Writer is moved into a background thread and dropped there.
    {
        let mut writer = pair.master.take_writer()
            .map_err(|e| format!("获取 PTY writer 失败: {}", e))?;
        let prompt = stdin_data.clone();
        std::thread::spawn(move || {
            use std::io::Write;
            let _ = writer.write_all(prompt.as_bytes());
            let _ = writer.flush();
            // writer dropped here → EOF on PTY stdin
        });
    }

    {
        let mut terminals = recover_lock(&PTY_TERMINALS);
        terminals.insert(
            terminal_id.clone(),
            PtyTerminal {
                child,
                writer: None, // stdin is one-shot; not needed after prompt delivery
                master: pair.master,
            },
        );
    }

    spawn_output_reader(reader, app.clone(), terminal_id.clone(), "stdout");

    let app_exit = app.clone();
    let tid_exit = terminal_id.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let mut terminals = recover_lock(&PTY_TERMINALS);
            match terminals.get_mut(&tid_exit) {
                Some(terminal) => {
                    if let Ok(Some(status)) = terminal.child.try_wait() {
                        let code = status.exit_code() as i32;
                        drop(terminals);
                        let _ = app_exit.emit(
                            "terminal-exit",
                            TerminalExit {
                                terminal_id: tid_exit.clone(),
                                code: Some(code),
                            },
                        );
                        let mut terminals = recover_lock(&PTY_TERMINALS);
                        terminals.remove(&tid_exit);
                        break;
                    }
                }
                None => break,
            }
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
            if let Some(ref mut writer) = terminal.writer {
                writer
                    .write_all(data.as_bytes())
                    .map_err(|e| format!("写入失败: {}", e))?;
                writer
                    .flush()
                    .map_err(|e| format!("刷新失败: {}", e))?;
                return Ok(());
            } else {
                return Err("stdin 不可用 (PTY writer 已关闭)".into());
            }
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

    Ok(()) // Already exited and cleaned up
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

// ── Slash commands (product layer, not model layer) ──────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommandDef {
    pub name: String,
    pub description: String,
    pub icon: String,
    pub category: String,
}

fn slash_cmd(name: &str, desc: &str, icon: &str, category: &str) -> SlashCommandDef {
    SlashCommandDef { name: name.into(), description: desc.into(), icon: icon.into(), category: category.into() }
}

fn scan_claude_commands(dir: &std::path::Path) -> Vec<SlashCommandDef> {
    let mut cmds = Vec::new();
    if !dir.is_dir() { return cmds; }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "md") {
                let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
                if name.is_empty() { continue; }
                let desc = std::fs::read_to_string(&path).ok()
                    .and_then(|c| c.lines().find(|l| !l.trim().is_empty())
                        .map(|l| l.trim_start_matches('#').trim().to_string()))
                    .unwrap_or_else(|| format!("自定义: {}", name));
                cmds.push(slash_cmd(&format!("/{}", name), &desc, "extension", "custom"));
            }
        }
    }
    cmds
}

// ── Open external terminal ────────────────────────────────────────────

#[command]
pub async fn terminal_open_external(cwd: String, _skip_permissions: bool) -> Result<(), String> {
    // 校验路径，防止命令注入
    if path_guard::contains_shell_metachars(&cwd) {
        return Err("路径包含不允许的字符".into());
    }
    let canonical = path_guard::validate_path_exists(&cwd)?;

    // skip_permissions 参数已由前端硬编码为 false，忽略用户传入值
    let perm_flag = "";
    let cmd_str = format!("cd /d \"{}\" && claude{}", canonical.to_string_lossy(), perm_flag);
    Command::new("cmd")
        .args(["/C", "start", "cmd.exe", "/K", &cmd_str])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn claude_commands_list(project_dir: Option<String>) -> Vec<SlashCommandDef> {
    let mut cmds = vec![
        // ── Claude Code built-in ──
        slash_cmd("/clear", "清空当前会话", "delete_sweep", "claude"),
        slash_cmd("/compact", "压缩上下文", "compress", "claude"),
        slash_cmd("/config", "查看/修改配置", "settings", "claude"),
        slash_cmd("/cost", "查看 token 用量", "paid", "claude"),
        slash_cmd("/diff", "查看 git diff", "difference", "claude"),
        slash_cmd("/doctor", "诊断安装", "health_and_safety", "claude"),
        slash_cmd("/export", "导出会话", "download", "claude"),
        slash_cmd("/help", "帮助信息", "help", "claude"),
        slash_cmd("/init", "初始化 CLAUDE.md", "rocket_launch", "claude"),
        slash_cmd("/login", "登录账号", "login", "claude"),
        slash_cmd("/logout", "登出账号", "logout", "claude"),
        slash_cmd("/mcp", "管理 MCP 服务器", "dns", "claude"),
        slash_cmd("/memory", "查看/编辑记忆", "psychology", "claude"),
        slash_cmd("/model", "切换模型", "smart_toy", "claude"),
        slash_cmd("/permissions", "管理权限", "shield", "claude"),
        slash_cmd("/pr-review", "审查 PR", "rate_review", "claude"),
        slash_cmd("/resume", "恢复会话", "history", "claude"),
        slash_cmd("/status", "系统状态", "info", "claude"),
        slash_cmd("/vim", "vim 模式", "keyboard", "claude"),
        // ── Skills ──
        slash_cmd("/review", "审查分支/PR", "grading", "skill"),
        slash_cmd("/code-review", "代码审查", "rate_review", "skill"),
        slash_cmd("/security-review", "安全审查", "security", "skill"),
        slash_cmd("/simplify", "简化代码", "compress", "skill"),
        slash_cmd("/diagnose", "诊断 bug", "bug_report", "skill"),
        slash_cmd("/verify", "验证变更", "verified", "skill"),
        slash_cmd("/run", "启动应用", "play_arrow", "skill"),
        slash_cmd("/prototype", "构建原型", "build_circle", "skill"),
        slash_cmd("/brainstorming", "头脑风暴", "lightbulb", "skill"),
        slash_cmd("/deep-research", "深度研究", "manage_search", "skill"),
        slash_cmd("/doc-coauthoring", "协作写文档", "edit_note", "skill"),
        slash_cmd("/design-engineer-3", "界面设计", "palette", "skill"),
        slash_cmd("/ui-ux-pro-max", "UI/UX 设计", "design_services", "skill"),
        slash_cmd("/taste-skill", "前端设计优化", "auto_awesome", "skill"),
        slash_cmd("/redesign-skill", "升级网站", "web", "skill"),
        slash_cmd("/pdf", "处理 PDF", "picture_as_pdf", "skill"),
        slash_cmd("/docx", "处理 Word", "description", "skill"),
        slash_cmd("/xlsx", "处理 Excel", "table_chart", "skill"),
        slash_cmd("/pptx", "处理 PPT", "slideshow", "skill"),
        slash_cmd("/webapp-testing", "Web 测试", "web_asset", "skill"),
        slash_cmd("/image-to-code-skill", "图片转代码", "image", "skill"),
    ];

    // ── Custom commands from .claude/commands/ ──
    if let Some(ref dir) = project_dir {
        cmds.extend(scan_claude_commands(&std::path::Path::new(dir).join(".claude").join("commands")));
    }
    if let Some(home) = dirs::home_dir() {
        cmds.extend(scan_claude_commands(&home.join(".claude").join("commands")));
    }

    cmds
}

/// Scan for active dev server ports by checking project-configured ports + common dev ports.
/// Returns only the ports that are currently in use.
#[command]
pub async fn network_scan_active_ports(db: State<'_, Database>) -> Result<Vec<u16>, String> {
    let mut ports: HashSet<u16> = HashSet::new();

    // Common dev server ports
    for &p in &[3000u16, 3001, 4000, 4200, 5000, 5173, 5174, 6006, 7000, 8000, 8080, 8081, 8888, 9000] {
        ports.insert(p);
    }

    // Extract ports from project commands
    if let Ok(rows) = db.query_json(
        "SELECT frontendCommand, backendCommand FROM projects WHERE deletedAt IS NULL",
        rusqlite::params![],
    ) {
        if let Some(arr) = rows.as_array() {
            let port_re = Regex::new(r"(?:--port|-p|--listen|PORT=)[:\s]*(\d{2,5})").ok();
            let colon_re = Regex::new(r":(\d{2,5})(?:/|\s|$)").ok();
            for row in arr {
                for key in &["frontendCommand", "backendCommand"] {
                    if let Some(cmd) = row.get(*key).and_then(|v| v.as_str()) {
                        if let Some(re) = &port_re {
                            for cap in re.captures_iter(cmd) {
                                if let Ok(p) = cap[1].parse::<u16>() {
                                    if p > 0 { ports.insert(p); }
                                }
                            }
                        }
                        if let Some(re) = &colon_re {
                            for cap in re.captures_iter(cmd) {
                                if let Ok(p) = cap[1].parse::<u16>() {
                                    if p > 0 { ports.insert(p); }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Probe ports in parallel
    let port_list: Vec<u16> = ports.into_iter().collect();
    let handles: Vec<_> = port_list
        .into_iter()
        .map(|port| {
            std::thread::spawn(move || {
                let addr = format!("127.0.0.1:{}", port);
                let in_use = TcpStream::connect_timeout(
                    &addr.parse().unwrap(),
                    Duration::from_millis(200),
                ).is_ok();
                if in_use { Some(port) } else { None }
            })
        })
        .collect();

    let mut active: Vec<u16> = Vec::new();
    for h in handles {
        if let Ok(Some(port)) = h.join() {
            active.push(port);
        }
    }

    active.sort();
    Ok(active)
}
