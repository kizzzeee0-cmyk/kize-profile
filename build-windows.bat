@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :node_missing
where npm >nul 2>nul
if errorlevel 1 goto :node_missing

if not exist "node_modules" (
  echo Installing required packages...
  call npm install
  if errorlevel 1 goto :error
)

echo Building production site...
call npm run build
if errorlevel 1 goto :error

echo.
echo Build complete. Output folder: dist
echo.
pause
exit /b 0

:node_missing
echo.
echo ERROR: Node.js or npm was not found.
echo Install the LTS version of Node.js from https://nodejs.org/
echo.
pause
exit /b 1

:error
echo.
echo ERROR: Build failed.
echo Please copy the error messages above and send them to ChatGPT.
echo.
pause
exit /b 1
