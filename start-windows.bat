@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :node_missing
where npm >nul 2>nul
if errorlevel 1 goto :node_missing

if not exist "node_modules" (
  echo [1/2] Installing required packages...
  call npm install
  if errorlevel 1 goto :error
)

echo [2/2] Starting development server...
echo.
echo When Vite is ready, open this address in your browser:
echo http://localhost:5173/
echo.
call npm run dev
exit /b 0

:node_missing
echo.
echo ERROR: Node.js or npm was not found.
echo Install the LTS version of Node.js from https://nodejs.org/
echo Then close this window and run this file again.
echo.
pause
exit /b 1

:error
echo.
echo ERROR: The project could not be started.
echo Please copy the error messages above and send them to ChatGPT.
echo.
pause
exit /b 1
