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
                        commands::workspace::terminal::cleanup_all();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::project::projects::projects_list,
            commands::project::projects::projects_get_by_id,
            commands::project::projects::projects_create,
            commands::project::projects::projects_update,
            commands::project::projects::projects_delete,
            commands::project::projects::projects_update_status,
            commands::project::projects::projects_get_stats,
            commands::project::projects::projects_open,
            commands::project::projects::projects_refresh,
            commands::project::projects::detect_project_cwd,
            commands::project::projects::debug_project_raw,
            commands::project::projects::projects_launch,
            commands::project::projects::projects_stop,
            commands::project::projects::projects_check_environment,
            commands::project::projects::projects_batch_import,
            commands::project::tasks::tasks_list,
            commands::project::tasks::tasks_create,
            commands::project::tasks::tasks_update,
            commands::project::tasks::tasks_delete,
            commands::project::tasks::tasks_update_status,
            commands::project::repos::repos_list,
            commands::project::repos::repos_add,
            commands::project::repos::repos_update,
            commands::project::repos::repos_remove,
            commands::project::repos::repos_sync,
            commands::project::documents::documents_list,
            commands::project::documents::documents_get_by_id,
            commands::project::documents::documents_create,
            commands::project::documents::documents_update,
            commands::project::documents::documents_delete,
            commands::project::milestones::milestones_list,
            commands::project::milestones::milestones_create,
            commands::project::milestones::milestones_update,
            commands::project::milestones::milestones_delete,
            commands::project::tags::tags_list,
            commands::project::tags::tags_create,
            commands::project::tags::tags_update,
            commands::project::tags::tags_delete,
            commands::project::tags::tags_assign_to_project,
            commands::project::tags::tags_remove_from_project,
            commands::project::search::global_search,
            commands::project::timeline::get_timeline,
            commands::project::timeline::get_project_timeline,
            commands::project::detect::detect_local_project,
            commands::project::detect::detect_git_repo,
            commands::project::detect::detect_scan_directory,
            commands::project::detect::detect_installed_agents,
            commands::project::brain::brain_analyze_project,
            // Agent sessions & browser memory
            commands::workspace::sessions::sessions_start,
            commands::workspace::sessions::sessions_append_message,
            commands::workspace::sessions::sessions_end,
            commands::workspace::sessions::sessions_update,
            commands::workspace::sessions::sessions_list,
            commands::workspace::sessions::sessions_messages,
            commands::workspace::sessions::sessions_cleanup_stale,
            commands::workspace::sessions::browser_record_visit,
            commands::workspace::sessions::browser_list_visits,
            commands::workspace::sessions::browser_find_visits_by_url,
            // Agent tasks
            commands::workspace::agent_tasks::agent_tasks_list,
            commands::workspace::agent_tasks::agent_tasks_create,
            commands::workspace::agent_tasks::agent_tasks_update,
            commands::workspace::agent_tasks::agent_tasks_delete,
            commands::workspace::agent_tasks::agent_tasks_bulk_create,
            // Model providers & agent configs
            commands::workspace::agent_configs::providers_list,
            commands::workspace::agent_configs::providers_create,
            commands::workspace::agent_configs::providers_update,
            commands::workspace::agent_configs::providers_delete,
            commands::workspace::agent_configs::agent_configs_list,
            commands::workspace::agent_configs::agent_configs_list_by_provider,
            commands::workspace::agent_configs::agent_configs_create,
            commands::workspace::agent_configs::agent_configs_update,
            commands::workspace::agent_configs::agent_configs_delete,
            commands::workspace::terminal::terminal_start,
            commands::workspace::terminal::terminal_stop,
            commands::workspace::terminal::terminal_input,
            commands::workspace::terminal::terminal_start_shell,
            commands::workspace::terminal::terminal_start_agent,
            commands::workspace::terminal::terminal_start_agent_piped,
            commands::workspace::terminal::terminal_resize,
            // File operations
            commands::workspace::files::files_list_directory,
            commands::workspace::files::files_read,
            commands::workspace::files::files_write,
            commands::workspace::files::files_write_base64,
            commands::workspace::files::files_get_tree,
            commands::workspace::files::files_open_in_ide,
            commands::workspace::files::files_create,
            commands::workspace::files::files_rename,
            commands::workspace::files::files_delete,
            // Git operations
            commands::git::git::git_status,
            commands::git::git::git_log,
            commands::git::git::git_branches,
            commands::git::git::git_diff,
            commands::git::git::git_branch_switch,
            commands::git::git::git_stash_list,
            commands::git::git::git_add,
            commands::git::git::git_commit,
            commands::git::git::git_push,
            commands::git::git::git_diff_commit,
            commands::git::git::git_pull,
            commands::git::git::git_tag_list,
            commands::git::git::git_tag_create,
            commands::git::git::git_tag_delete,
            commands::git::git::git_reset_head,
            commands::git::git::git_restore,
            commands::git::git::git_show_file,
            commands::git::git::git_fetch,
            commands::git::git::git_branch_create,
            commands::git::git::git_revert,
            // Dependency detection
            commands::project::dependencies::detect_project_dependencies,
            commands::project::dependencies::get_launch_order,
            commands::project::dependencies::analyze_docker_compose,
            commands::project::dependencies::detect_monorepo_structure,
            // Health check
            commands::project::health::run_all_health_checks,
            commands::project::health::run_health_check_for_project,
            commands::project::health::get_project_health_history,
            commands::project::health::get_all_latest_health,
            // Workspaces
            commands::workspace::workspaces::workspaces_list,
            commands::workspace::workspaces::workspaces_create,
            commands::workspace::workspaces::workspaces_update,
            commands::workspace::workspaces::workspaces_delete,
            commands::workspace::workspaces::workspaces_assign_project,
            commands::workspace::workspaces::workspaces_save_layout,
            commands::workspace::workspaces::workspaces_load_layout,
            commands::workspace::workspaces::workspaces_stats,
            // Builds
            commands::build::builds::builds_list,
            commands::build::builds::builds_get_by_id,
            commands::build::builds::builds_create,
            commands::build::builds::builds_update,
            commands::build::builds::builds_delete,
            commands::build::builds::builds_add_log,
            commands::build::builds::builds_get_logs,
            // Templates
            commands::build::templates::templates_list,
            commands::build::templates::templates_get_by_id,
            commands::build::templates::templates_create,
            commands::build::templates::templates_delete,
            // Integrations
            commands::build::integrations::integrations_list,
            commands::build::integrations::integrations_get_by_id,
            commands::build::integrations::integrations_create,
            commands::build::integrations::integrations_update,
            commands::build::integrations::integrations_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
