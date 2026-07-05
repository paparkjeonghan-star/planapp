@echo off
setlocal

set "ROOT=%~dp0"

echo Starting PlanApp development servers...
echo.
echo Backend:  http://localhost:4000/api/health
echo Frontend: http://127.0.0.1:5174/
echo.
echo Keep the two server windows open while using the app.
echo Close those windows or press Ctrl+C inside them to stop the servers.
echo.

start "PlanApp Backend" cmd /k "cd /d ""%ROOT%backend"" && npm.cmd run dev"
start "PlanApp Frontend" cmd /k "cd /d ""%ROOT%frontend"" && npm.cmd run dev"

endlocal
