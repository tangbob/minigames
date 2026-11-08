@echo off
cd /d %~dp0
start "" pythonw -m http.server 8770 --bind 127.0.0.1
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8770/"