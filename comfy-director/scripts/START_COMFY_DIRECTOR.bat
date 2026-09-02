@echo off
REM Avvio "tutto in uno" per l'utente finale su Windows: builda il frontend, avvia il
REM Bridge (che serve anche il frontend buildato dallo stesso URL) e apre il browser.
REM Richiede Python 3.11+ e Node.js 20+ installati e nel PATH.
setlocal
set ROOT=%~dp0..

echo ============================================
echo   COMFY DIRECTOR - avvio
echo ============================================

echo.
echo [1/3] Preparo il frontend...
cd /d "%ROOT%\apps\frontend"
if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo [Comfy Director] npm install fallito. Verifica che Node.js sia installato.
        exit /b 1
    )
)
call npm run build
if errorlevel 1 (
    echo [Comfy Director] Build del frontend fallita.
    exit /b 1
)

echo.
echo [2/3] Preparo il Bridge (Python)...
cd /d "%ROOT%\apps\bridge"
if not exist ".venv" (
    python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
python -m pip install -e . >nul
if errorlevel 1 (
    echo [Comfy Director] Installazione dipendenze Python fallita.
    exit /b 1
)
if not exist ".env" (
    copy .env.example .env >nul
)

echo.
echo [3/3] Avvio Comfy Director su http://127.0.0.1:8787 ...
start "" http://127.0.0.1:8787
python -m uvicorn bridge.main:app --host 127.0.0.1 --port 8787

endlocal
