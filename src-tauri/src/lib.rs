// 壳只是装载器: 开机依次探「本机现发 → 本机 dev → 线上子域名」，探到哪个就加载哪个，
// 都不通就留在包内自带的那份 dist。改前端不用重打壳。
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

// 与 tools/serve-web.mjs、Cloudflare 子域名路由三处对应, 改一起改。
const LOCAL_BASES: [&str; 2] = ["http://127.0.0.1:8770/", "http://localhost:5370/"];
const REMOTE_BASE: &str = "https://minigames.zhinengtai.xyz/";

// http(s)://host:port/… → (host, port), 缺省端口按 scheme
fn host_and_port(url: &str) -> Option<(String, u16)> {
    let (scheme, rest) = url.split_once("://").unwrap_or(("http", url));
    let authority = rest.split('/').next().unwrap_or("");
    let authority = authority.rsplit_once('@').map(|(_, h)| h).unwrap_or(authority);
    if authority.is_empty() {
        return None;
    }
    let default_port = if scheme.eq_ignore_ascii_case("https") { 443 } else { 80 };
    match authority.rsplit_once(':') {
        Some((h, p)) => Some((h.to_string(), p.parse().unwrap_or(default_port))),
        None => Some((authority.to_string(), default_port)),
    }
}

fn is_up(url: &str, timeout_ms: u64) -> bool {
    let Some((host, port)) = host_and_port(url) else {
        return false;
    };
    let Some(addr) = (host.as_str(), port).to_socket_addrs().ok().and_then(|mut a| a.next()) else {
        return false;
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(timeout_ms)).is_ok()
}

// 自测口: 环境变量 MINIGAMES_PC_URL, 或 exe 同目录 minigames-shell.json 的 {"localBase": "..."}。
fn local_override() -> String {
    if let Ok(v) = std::env::var("MINIGAMES_PC_URL") {
        if !v.trim().is_empty() {
            return v.trim().to_string();
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(p) = exe.parent().map(|d| d.join("minigames-shell.json")) {
            if let Ok(s) = std::fs::read_to_string(p) {
                if let Some(v) = serde_json::from_str::<serde_json::Value>(&s)
                    .ok()
                    .and_then(|j| j.get("localBase").and_then(|b| b.as_str()).map(String::from))
                {
                    if !v.trim().is_empty() {
                        return v;
                    }
                }
            }
        }
    }
    String::new()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            use tauri::Manager;
            let shell_version = format!("{}+{}", app.package_info().version, env!("MG_BUILD_STAMP"));
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_title(&format!("MINIGAMES 小游戏合集 {shell_version}"));
                if let Some(icon) = app.default_window_icon().cloned() {
                    let _ = win.set_icon(icon);
                }
                let mut chosen: Option<String> = None;
                let ov = local_override();
                if !ov.is_empty() && is_up(&ov, 400) {
                    chosen = Some(ov);
                }
                if chosen.is_none() {
                    for base in LOCAL_BASES {
                        if is_up(base, 400) {
                            chosen = Some(base.to_string());
                            break;
                        }
                    }
                }
                if chosen.is_none() && is_up(REMOTE_BASE, 1500) {
                    chosen = Some(REMOTE_BASE.to_string());
                }
                if let Some(base) = chosen {
                    let sep = if base.contains('?') { '&' } else { '?' };
                    if let Ok(url) = tauri::Url::parse(&format!("{base}{sep}pcShell={shell_version}")) {
                        let _ = win.navigate(url);
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("MINIGAMES 桌面壳启动失败");
}