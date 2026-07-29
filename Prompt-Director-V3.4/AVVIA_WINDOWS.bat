@echo off
cd /d "%~dp0"
echo Avvio Prompt Director V3.4 su http://127.0.0.1:8080
start "" http://127.0.0.1:8080
py -m http.server 8080 --bind 127.0.0.1 2>nul || python -m http.server 8080 --bind 127.0.0.1
pause
