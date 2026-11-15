// 壳自己的构建号: Cargo 的 version 永远不变, 构建时间才能判新旧。
// 编进环境变量, lib.rs 用 env!("MG_BUILD_STAMP") 读, 拼进 URL 的 ?pcShell=<版本>。
fn main() {
    let stamp = {
        #[cfg(windows)]
        {
            std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", "[DateTime]::UtcNow.ToString('yyyyMMdd.HHmm')"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        }
        #[cfg(not(windows))]
        {
            std::process::Command::new("date")
                .args(["-u", "+%Y%m%d.%H%M"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        }
    }
    .unwrap_or_else(|| "0.0".to_string());
    println!("cargo:rustc-env=MG_BUILD_STAMP={stamp}");
    // 改了源码/配置就重算构建号, 否则改完再编还是上次那个数。
    println!("cargo:rerun-if-changed=src");
    println!("cargo:rerun-if-changed=Cargo.toml");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=capabilities");
    if let Ok(dir) = std::env::var("OUT_DIR") {
        let _ = std::fs::write(std::path::Path::new(&dir).join("mg-build-stamp.txt"), &stamp);
    }
    tauri_build::build()
}