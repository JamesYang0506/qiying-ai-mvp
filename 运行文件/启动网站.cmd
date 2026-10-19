@echo off
setlocal
chcp 65001 >nul
title Qiying Website - IP and Port
cd /d "%~dp0"
set "NODE_EXE=node.exe"
where node.exe >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
  ) else (
    echo Node.js 20 or newer is required. Please install Node.js and try again.
    pause
    exit /b 1
  )
)
"%NODE_EXE%" "%~dp0start-website.mjs" %*
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
  echo.
  echo Website startup failed. See the message above.
)
echo.
echo Press any key to close this window...
pause >nul
exit /b %RESULT%
