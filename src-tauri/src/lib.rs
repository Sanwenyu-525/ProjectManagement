mod commands;
mod db;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_screenshots::init())
        .setup(|app| {
            // 设置窗口图标
            let icon_path = app
                .path()
                .resource_dir()
                .ok()
                .map(|p| p.join("icons/icon.ico"))
                .filter(|p| p.exists())
                .unwrap_or_else(|| {
                    std::env::current_dir()
                        .unwrap_or_default()
                        .join("src-tauri/icons/icon.ico")
                });
            if let Ok(icon) = tauri::image::Image::from_path(&icon_path) {
                if let Some(window) = app.webview_windows().values().next() {
                    window.set_icon(icon).ok();
                }
            }

            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();

            let db_path = app_dir.join("devhub.db");
            let database = Database::new(&db_path).expect("failed to initialize database");
            app.manage(database);

            // Kill all child processes when the window is closed
            let window = app.webview_windows().values().next().cloned();
            if let Some(window) = window {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        commands::terminal::cleanup_all();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::projects::projects_list,
            commands::projects::projects_get_by_id,
            commands::projects::projects_create,
            commands::projects::projects_update,
            commands::projects::projects_delete,
            commands::projects::projects_update_status,
            commands::projects::projects_get_stats,
            commands::projects::projects_open,
            commands::projects::projects_refresh,
            commands::projects::detect_project_cwd,
            commands::projects::debug_project_raw,
            commands::projects::projects_launch,
            commands::projects::projects_stop,
            commands::projects::projects_check_environment,
            commands::projects::projects_batch_import,
            commands::tasks::tasks_list,
            commands::tasks::tasks_create,
            commands::tasks::tasks_update,
            commands::tasks::tasks_delete,
            commands::tasks::tasks_update_status,
            commands::repos::repos_list,
            commands::repos::repos_add,
            commands::repos::repos_update,
            commands::repos::repos_remove,
            commands::repos::repos_sync,
            commands::documents::documents_list,
            commands::documents::documents_get_by_id,
            commands::documents::documents_create,
            commands::documents::documents_update,
            commands::documents::documents_delete,
            commands::milestones::milestones_list,
            commands::milestones::milestones_create,
            commands::milestones::milestones_update,
            commands::milestones::milestones_delete,
            commands::tags::tags_list,
            commands::tags::tags_create,
            commands::tags::tags_update,
            commands::tags::tags_delete,
            commands::tags::tags_assign_to_project,
            commands::tags::tags_remove_from_project,
            commands::search::global_search,
            commands::timeline::get_timeline,
            commands::timeline::get_project_timeline,
            commands::detect::detect_local_project,
            commands::detect::detect_git_repo,
            commands::detect::detect_scan_directory,
            commands::detect::detect_installed_agents,
            commands::brain::brain_analyze_project,
            // Agent sessions & browser memory
            commands::sessions::sessions_start,
            commands::sessions::sessions_append_message,
            commands::sessions::sessions_end,
            commands::sessions::sessions_list,
            commands::sessions::sessions_messages,
            commands::sessions::browser_record_visit,
            commands::sessions::browser_list_visits,
            commands::sessions::browser_find_visits_by_url,
            commands::terminal::terminal_start,
            commands::terminal::terminal_stop,
            commands::terminal::terminal_input,
            commands::terminal::terminal_start_shell,
            commands::terminal::terminal_start_agent,
            commands::terminal::terminal_setup_agent_launcher,
            commands::terminal::terminal_resize,
            // Git operations
            commands::git::git_status,
            commands::git::git_log,
            commands::git::git_branches,
            commands::git::git_diff,
            commands::git::git_branch_switch,
            commands::git::git_stash_list,
            commands::git::git_add,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_diff_commit,
            commands::git::git_pull,
            commands::git::git_tag_list,
            commands::git::git_tag_create,
            commands::git::git_tag_delete,
            commands::git::git_reset_head,
            // Dependency detection
            commands::dependencies::detect_project_dependencies,
            commands::dependencies::get_launch_order,
            commands::dependencies::analyze_docker_compose,
            commands::dependencies::detect_monorepo_structure,
            // Health check
            commands::health::run_all_health_checks,
            commands::health::run_health_check_for_project,
            commands::health::get_project_health_history,
            commands::health::get_all_latest_health,
            // Workspaces
            commands::workspaces::workspaces_list,
            commands::workspaces::workspaces_create,
            commands::workspaces::workspaces_update,
            commands::workspaces::workspaces_delete,
            commands::workspaces::workspaces_assign_project,
            commands::workspaces::workspaces_save_layout,
            commands::workspaces::workspaces_load_layout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
