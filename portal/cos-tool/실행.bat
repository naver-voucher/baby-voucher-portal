@echo off
cd /d "%~dp0app"
start "" /min python proxy.py
timeout /t 2 /nobreak >nul
start http://localhost:5000
