@echo off
echo Starting Classroom Utilization System in Development Mode...
echo.

REM Kill any existing Node processes
taskkill /F /IM node.exe >nul 2>&1

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Check if nodemon is installed
echo Checking dependencies...
call npm list nodemon >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing nodemon...
    call npm install
)

echo.
echo Starting development servers...
echo React will run on: http://localhost:3000
echo API will run on: http://localhost:5000
echo Login with: test@example.com / password123
echo.
echo Nodemon will automatically restart server when you save files.
echo Type 'rs' and press Enter to manually restart the server.
echo.

REM Start the development servers
call npm run dev

pause
