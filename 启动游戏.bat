@echo off
cd /d %~dp0
start "" pythonw server.pyw
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8770/"