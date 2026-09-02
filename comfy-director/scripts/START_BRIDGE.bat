@echo off
REM Avvia SOLO il Bridge (backend). Utile in sviluppo insieme a `npm run dev` nel
REM frontend (che gira separatamente su http://127.0.0.1:5173).
REM Per l'avvio "tutto in uno" per l'utente finale, usa START_COMFY_DIRECTOR.bat.
setlocal
cd /d "%~dp0..\apps\bridge"

if not exist ".venv" (
    echo [Comfy Director] Creo l'ambiente virtuale Python in apps\bridge\.venv ...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo [Comfy Director] Installo/aggiorno le dipendenze del Bridge ...
python -m pip install --upgrade pip >nul
python -m pip install -e . >nul
if errorlevel 1 (
    echo [Comfy Director] Installazione dipendenze fallita. Controlla la connessione o l'output sopra.
    exit /b 1
)

if not exist ".env" (
    echo [Comfy Director] Copio .env.example in .env ^(personalizzabile^) ...
    copy .env.example .env >nul
)

echo [Comfy Director] Avvio il Bridge su http://127.0.0.1:8787 ...
python -m uvicorn bridge.main:app --host 127.0.0.1 --port 8787

endlocal
