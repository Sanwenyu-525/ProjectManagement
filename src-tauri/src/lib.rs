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
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();

            let db_path = app_dir.join("devhub.db");
            let database = Database::new(&db_path).expect("failed to initialize database");
            app.manage(database);
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
            commands::terminal::terminal_start,
            commands::terminal::terminal_stop,
            commands::terminal::terminal_input,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
