@echo off
rem 双击即玩: 确保有构建产物 -> 拉起/复用 8770 现发 -> 打开浏览器。
rem 服务器经 WMI+vbs 无窗口常驻, 关掉本 bat 窗口不影响游戏。
cd /d %~dp0
if not exist dist\index.html (
  echo [minigames] 首次运行, 先构建前端...
  call npm run build
  if errorlevel 1 (
    echo [minigames] 构建失败, 请检查 node/npm 是否安装。
    pause
    exit /b 1
  )
)
powershell -NoProfile -ExecutionPolicy Bypass -File server\restart-web-win.ps1
start "" "http://127.0.0.1:8770/"