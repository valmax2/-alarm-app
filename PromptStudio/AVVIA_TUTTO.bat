@echo off
title Prompt Studio - Avvio completo
cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL%==0 (
    set "PYCMD=python"
) else (
    where py >nul 2>nul
    if %ERRORLEVEL%==0 (
        set "PYCMD=py -3"
    ) else (
        echo.
        echo [ERRORE] Python non e' stato trovato sul PC.
        echo Installa Python 3 da https://www.python.org/downloads/
        echo ^(durante l'installazione spunta "Add python.exe to PATH"^)
        echo poi rilancia questo file.
        echo.
        pause
        exit /b 1
    )
)

echo ============================================================
echo   PROMPT STUDIO - Avvio completo
echo ============================================================
echo.
echo Avvio il Bridge (ComfyUI)...
start "Prompt Studio - Bridge" /d "%~dp0bridge" cmd /k %PYCMD% bridge_server.py

echo Avvio il server dell'app...
start "Prompt Studio - Server" /d "%~dp0" cmd /k %PYCMD% -m http.server 8080

echo Attendo che il server sia pronto...
timeout /t 2 /nobreak >nul

echo Apro il browser...
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" http://localhost:8080
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" http://localhost:8080
) else (
    start http://localhost:8080
)

echo.
echo Fatto. Sono state aperte 2 finestre nere (Bridge e Server):
echo lasciale aperte finche' usi Prompt Studio. Questa finestra
echo si puo' chiudere.
echo.
pause
