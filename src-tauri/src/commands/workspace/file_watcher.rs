use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use notify::event::{ModifyKind, RenameMode};
use tauri::{command, AppHandle, Emitter};

use super::files::SKIP_DIRS;

// ── Event payload (emitted to frontend) ──────────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangedEvent {
    pub root_path: String,
    pub changed_path: String,
    pub kind: String,
}

// ── Internal state ──────────────────────────────────────────────────

struct FileWatcherState {
    watcher: Option<RecommendedWatcher>,
    watched_roots: HashSet<PathBuf>,
    app_handle: Option<AppHandle>,
    debounce_map: HashMap<PathBuf, Instant>,
    /// 事件风暴防护：记录每个根目录在当前窗口内的事件计数和窗口起始时间
    flood_counts: HashMap<PathBuf, (Instant, u32)>,
}

static FILE_WATCHER: std::sync::LazyLock<Mutex<FileWatcherState>> =
    std::sync::LazyLock::new(|| {
        Mutex::new(FileWatcherState {
            watcher: None,
            watched_roots: HashSet::new(),
            app_handle: None,
            debounce_map: HashMap::new(),
            flood_counts: HashMap::new(),
        })
    });

fn recover_lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

// ── Initialization ──────────────────────────────────────────────────

pub fn init_watcher(app_handle: AppHandle) {
    let watcher = notify::recommended_watcher(|res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            handle_notify_event(event);
        }
    })
    .expect("Failed to create filesystem watcher");

    let mut state = recover_lock(&FILE_WATCHER);
    state.watcher = Some(watcher);
    state.app_handle = Some(app_handle);
}

// ── Event handler (runs on notify's callback thread) ─────────────────

fn handle_notify_event(event: Event) {
    let kind = match &event.kind {
        EventKind::Create(_) => "create",
        EventKind::Remove(_) => "delete",
        EventKind::Modify(ModifyKind::Name(_)) => "rename",
        EventKind::Modify(_) => "modify",
        _ => "other",
    };

    let changed_path = match &event.kind {
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => {
            event.paths.first()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default()
        }
        _ => event
            .paths
            .first()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
    };

    if changed_path.is_empty() {
        return;
    }

    // Skip events inside SKIP_DIRS (node_modules, .git, target, etc.)
    if should_skip_path(&changed_path) {
        return;
    }

    // 查找匹配的根目录 + 防抖检查 + 发送事件 — 单次加锁完成
    let mut state = recover_lock(&FILE_WATCHER);

    let root_path = find_matching_root(&state, &changed_path);
    let Some(root_path) = root_path else { return };

    // 防抖：300ms 内同一根目录的事件跳过
    let now = Instant::now();
    if let Some(last) = state.debounce_map.get(&root_path) {
        if now.duration_since(*last) < Duration::from_millis(300) {
            return;
        }
    }
    state.debounce_map.insert(root_path.clone(), now);

    // 事件风暴防护：1 秒内超过 50 个事件时暂停该根目录 5 秒
    let flood_entry = state.flood_counts.entry(root_path.clone()).or_insert((now, 0));
    if now.duration_since(flood_entry.0) > Duration::from_secs(1) {
        *flood_entry = (now, 1);
    } else {
        flood_entry.1 += 1;
        if flood_entry.1 > 50 {
            return; // 暂停转发事件，防止前端卡死
        }
    }

    if let Some(app) = &state.app_handle {
        let _ = app.emit(
            "file-changed",
            FileChangedEvent {
                root_path: root_path.to_string_lossy().to_string(),
                changed_path,
                kind: kind.to_string(),
            },
        );
    }
}

fn find_matching_root(state: &FileWatcherState, changed_path: &str) -> Option<PathBuf> {
    let changed = Path::new(changed_path);
    let mut best: Option<PathBuf> = None;
    for root in &state.watched_roots {
        if changed.starts_with(root) {
            match &best {
                Some(b) if b.components().count() >= root.components().count() => {}
                _ => best = Some(root.clone()),
            }
        }
    }
    best
}

fn should_skip_path(path: &str) -> bool {
    let p = Path::new(path);
    for component in p.components() {
        if let Some(name) = component.as_os_str().to_str() {
            if SKIP_DIRS.contains(&name) {
                return true;
            }
        }
    }
    false
}

// ── Tauri commands ──────────────────────────────────────────────────

#[command]
pub async fn file_watcher_add_root(path: String) -> Result<(), String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err("Path is not a directory".into());
    }

    let mut state = recover_lock(&FILE_WATCHER);

    if state.watched_roots.contains(&root) {
        return Ok(());
    }

    if let Some(ref mut watcher) = state.watcher {
        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {e}"))?;
    }

    state.watched_roots.insert(root);
    Ok(())
}

#[command]
pub async fn file_watcher_remove_root(path: String) -> Result<(), String> {
    let root = PathBuf::from(&path);

    let mut state = recover_lock(&FILE_WATCHER);

    if !state.watched_roots.contains(&root) {
        return Ok(());
    }

    if let Some(ref mut watcher) = state.watcher {
        watcher
            .unwatch(&root)
            .map_err(|e| format!("Failed to unwatch directory: {e}"))?;
    }

    state.watched_roots.remove(&root);
    state.debounce_map.remove(&root);
    Ok(())
}
