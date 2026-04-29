// Tauri 2.x 네이티브 메뉴 (File / Edit / View / Help) — Phase 10-6.
//
// Frontend 의 dispatchShortcut / 라우팅 인프라를 재사용한다 — 메뉴 클릭 시
// `menu://<action-id>` 이벤트를 emit 하고 frontend `useMenuListener` 가 받아
// 기존 단축키/모달 로직을 트리거.
//
// 이렇게 분리하는 이유:
//   - 모든 액션이 이미 frontend 에 있음 (dispatchShortcut / RouterLink / modal state)
//   - Rust 가 이벤트만 fire-and-forget → 메뉴/Tauri 의 IPC 결합 최소화
//   - 사용자가 단축키를 발견하기 좋게 메뉴 항목에 단축키 표시 (accelerator)

use tauri::{
    menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager, Wry,
};

/// 메뉴 클릭 시 emit 되는 이벤트 prefix.
/// frontend 는 `menu://<id>` 로 listen.
const EVENT_PREFIX: &str = "menu://";

/// 빌더에 결합할 메뉴 생성. on_menu_event 와 짝으로 사용한다.
pub fn build(app: &AppHandle<Wry>) -> tauri::Result<tauri::menu::Menu<Wry>> {
    // File
    let file_settings = MenuItemBuilder::with_id("open-settings", "Settings…").build(app)?;
    let file_reload_repos =
        MenuItemBuilder::with_id("reload-repos", "Reload Repositories").build(app)?;
    let file_quit = PredefinedMenuItem::quit(app, Some("Quit"))?;
    let file = SubmenuBuilder::new(app, "File")
        .item(&file_settings)
        .item(&file_reload_repos)
        .separator()
        .item(&file_quit)
        .build()?;

    // Edit (시스템 기본 + 앱 액션)
    let edit_undo = MenuItemBuilder::with_id("undo-action", "Undo Last Git Action").build(app)?;
    let edit_redo = MenuItemBuilder::with_id("redo-action", "Redo Last Git Action").build(app)?;
    let edit_filter =
        MenuItemBuilder::with_id("filter-repos", "Find Repository…")
            .accelerator("CmdOrCtrl+Alt+F")
            .build(app)?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(&edit_undo)
        .item(&edit_redo)
        .separator()
        .item(&edit_filter)
        .build()?;

    // View
    let view_palette = MenuItemBuilder::with_id("command-palette", "Command Palette")
        .accelerator("CmdOrCtrl+P")
        .build(app)?;
    let view_toggle_sidebar = MenuItemBuilder::with_id("toggle-sidebar", "Toggle Sidebar")
        .accelerator("CmdOrCtrl+J")
        .build(app)?;
    let view_toggle_detail = MenuItemBuilder::with_id("toggle-detail", "Toggle Detail Panel")
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let view_toggle_terminal = MenuItemBuilder::with_id("toggle-terminal", "Toggle Terminal")
        .accelerator("CmdOrCtrl+`")
        .build(app)?;
    let view_toggle_theme =
        MenuItemBuilder::with_id("toggle-theme", "Toggle Light / Dark Theme").build(app)?;
    let view_reload =
        MenuItemBuilder::with_id("reload-window", "Reload Window")
            .accelerator("CmdOrCtrl+R")
            .build(app)?;
    let view_devtools = MenuItemBuilder::with_id("toggle-devtools", "Toggle Developer Tools")
        .accelerator("CmdOrCtrl+Shift+I")
        .build(app)?;
    let view_fullscreen = MenuItemBuilder::with_id("toggle-fullscreen", "Toggle Fullscreen")
        .accelerator("F11")
        .build(app)?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&view_palette)
        .separator()
        .item(&view_toggle_sidebar)
        .item(&view_toggle_detail)
        .item(&view_toggle_terminal)
        .separator()
        .item(&view_toggle_theme)
        .item(&view_fullscreen)
        .separator()
        .item(&view_reload)
        .item(&view_devtools)
        .build()?;

    // Repository — daily git ops (fetch/pull/push/branch/stash)
    let repo_fetch =
        MenuItemBuilder::with_id("repo-fetch", "Fetch")
            .accelerator("CmdOrCtrl+L")
            .build(app)?;
    let repo_pull =
        MenuItemBuilder::with_id("repo-pull", "Pull")
            .accelerator("CmdOrCtrl+Shift+L")
            .build(app)?;
    let repo_push =
        MenuItemBuilder::with_id("repo-push", "Push")
            .accelerator("CmdOrCtrl+Shift+K")
            .build(app)?;
    let repo_branch =
        MenuItemBuilder::with_id("repo-branch", "New Branch / Branch View")
            .accelerator("CmdOrCtrl+B")
            .build(app)?;
    let repo_stash = MenuItemBuilder::with_id("repo-stash-view", "Stash View")
        .accelerator("CmdOrCtrl+3")
        .build(app)?;
    let repository = SubmenuBuilder::new(app, "Repository")
        .item(&repo_fetch)
        .item(&repo_pull)
        .item(&repo_push)
        .separator()
        .item(&repo_branch)
        .item(&repo_stash)
        .build()?;

    // History — reflog / bisect / compare (모두 모달, 기존 window 트리거 재사용)
    let hist_reflog = MenuItemBuilder::with_id("open-reflog", "Reflog…").build(app)?;
    let hist_bisect = MenuItemBuilder::with_id("open-bisect", "Bisect…").build(app)?;
    let hist_compare = MenuItemBuilder::with_id("open-compare", "Compare…").build(app)?;
    let hist_search = MenuItemBuilder::with_id("commit-search", "Search Commits…")
        .accelerator("CmdOrCtrl+Shift+F")
        .build(app)?;
    let history = SubmenuBuilder::new(app, "History")
        .item(&hist_reflog)
        .item(&hist_bisect)
        .item(&hist_compare)
        .separator()
        .item(&hist_search)
        .build()?;

    // Help
    let help_shortcuts = MenuItemBuilder::with_id("show-shortcuts", "Keyboard Shortcuts")
        .accelerator("?")
        .build(app)?;
    let help_github =
        MenuItemBuilder::with_id("open-github", "Open GitHub Repository").build(app)?;
    let about_meta = AboutMetadataBuilder::new()
        .name(Some("git-fried"))
        .version(Some(env!("CARGO_PKG_VERSION").to_string()))
        .build();
    let help_about = PredefinedMenuItem::about(app, Some("About git-fried"), Some(about_meta))?;
    let help = SubmenuBuilder::new(app, "Help")
        .item(&help_shortcuts)
        .item(&help_github)
        .separator()
        .item(&help_about)
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&file)
        .item(&edit)
        .item(&view)
        .item(&repository)
        .item(&history)
        .item(&help)
        .build()?;

    Ok(menu)
}

/// 메뉴 클릭 핸들러. `on_menu_event` 에 등록한다.
pub fn handle_event(app: &AppHandle<Wry>, id: &str) {
    // 시스템 처리 (윈도/앱 레벨)
    if id == "reload-window" {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.eval("location.reload()");
        }
        return;
    }
    if id == "toggle-devtools" {
        #[cfg(debug_assertions)]
        if let Some(win) = app.get_webview_window("main") {
            if win.is_devtools_open() {
                win.close_devtools();
            } else {
                win.open_devtools();
            }
        }
        return;
    }
    if id == "toggle-fullscreen" {
        if let Some(win) = app.get_webview_window("main") {
            if let Ok(is_fs) = win.is_fullscreen() {
                let _ = win.set_fullscreen(!is_fs);
            }
        }
        return;
    }
    if id == "open-github" {
        // tauri-plugin-shell 사용 — frontend 가 처리하도록 위임 (plugin handle 직접 사용 회피).
        let event = format!("{EVENT_PREFIX}open-github");
        let _ = app.emit(&event, ());
        return;
    }

    // 그 외는 모두 frontend 위임 (`menu://<id>` 이벤트).
    let event = format!("{EVENT_PREFIX}{id}");
    let _ = app.emit(&event, ());
}

#[cfg(test)]
mod tests {
    #[test]
    fn event_prefix_constant() {
        assert_eq!(super::EVENT_PREFIX, "menu://");
    }
}
