@echo off
setlocal
cd /d "%~dp0"
set "PROFIT_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%PROFIT_PYTHON%" set "PROFIT_PYTHON=python"
echo Open http://127.0.0.1:8765 in your browser.
echo Keep this window open. Press Ctrl+C to stop.
"%PROFIT_PYTHON%" server.py --port 8765
pause
