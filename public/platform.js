// 三端共用的端识别。门户和任何游戏都可以引这一份（游戏里写 ../../platform.js），
// 不要各自猜 UA —— 口径只在这里改一次。
// 安卓壳: capacitor.config.json 的 appendUserAgent 打 MinigamesShell/<版本>
// PC 壳:  Tauri 加载前端时 URL 带 ?pcShell=<版本>
(function () {
  var ua = navigator.userAgent || "";
  var m = ua.match(/MinigamesShell\/([^\s;]+)/);
  var q = new URLSearchParams(location.search);
  var pc = q.get("pcShell");
  var touch = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || navigator.maxTouchPoints > 0;
  var kind = m ? "android" : pc ? "pc" : "web";
  window.MINIGAMES = {
    kind: kind,
    shellVersion: m ? m[1] : pc || "",
    touch: touch,
    label: kind === "android" ? "📱 安卓版" : kind === "pc" ? "🖥️ PC 版" : "🌐 网页版",
    // 壳只是装载器，前端永远来自线上或本机现发；游戏据此决定要不要显示「退出到合集」这类壳内入口
    inShell: kind !== "web",
    portalUrl: kind === "web" ? "/" : "../../index.html"
  };
})();