@echo off
title Prompt Studio - Bridge
color 0D
echo ============================================================
echo   PROMPT STUDIO - BRIDGE LOCALE
echo ============================================================
echo.
echo Sto avviando il Bridge che collega Prompt Studio a ComfyUI...
echo Non chiudere questa finestra finche' usi Prompt Studio.
echo.

where python >nul 2>nul
if %ERRORLEVEL%==0 (
    python "%~dp0bridge_server.py"
    goto :end
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py -3 "%~dp0bridge_server.py"
    goto :end
)

echo.
echo [ERRORE] Python non e' stato trovato sul PC.
echo Installa Python 3 da https://www.python.org/downloads/
echo (durante l'installazione spunta "Add python.exe to PATH")
echo poi rilancia questo file.
echo.
pause
goto :eof

:end
echo.
echo Il Bridge si e' fermato.
pause
