#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod files;

use tauri_plugin_sql::{Migration, MigrationKind};

fn main() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_local_schema",
        sql: r#"
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                client_name TEXT,
                location TEXT,
                current_revision TEXT NOT NULL DEFAULT 'P1',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_files (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                source_revision TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_project_files_project_id
                ON project_files(project_id);

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );
        "#,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            files::read_user_file,
            files::write_project_file
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:av-sw.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running AV-SW");
}
