@echo off
title Job Portal - All Services
color 0A

echo ========================================
echo   STARTING JOB PORTAL SERVICES
echo ========================================
echo.

echo [1/3] Starting Backend Server (Port 5000)...
start "Backend Server" cmd /k "cd C:\xampp\htdocs\job-portal\server && npm run dev"
timeout /t 3 /nobreak >nul

echo [2/3] Starting ML Service (Port 5001)...
start "ML Service" cmd /k "cd C:\xampp\htdocs\job-portal\ml-service && python recommendation_service.py"
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend (Port 5173)...
start "Frontend" cmd /k "cd C:\xampp\htdocs\job-portal\client && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   ✅ ALL SERVICES STARTED!
echo ========================================
echo.
echo   Backend:  http://localhost:5000
echo   ML:       http://localhost:5001
echo   Frontend: http://localhost:5173
echo.
echo   Press any key to close this window...
pause >nul