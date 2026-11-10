@echo off
cd /d C:\Users\User\OneDrive\Desktop\miles
set MYSQLD=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe
set MYSQL_DATA=C:\MySQLData

echo Checking MySQL on 127.0.0.1:3306...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 3306); $client.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Starting local MySQL server...
  start "" /b "%MYSQLD%" --datadir="%MYSQL_DATA%" --console
  timeout /t 5 /nobreak >nul
)

echo Building Angular frontend...
call npm run angular:build
if errorlevel 1 (
  echo.
  echo Angular build failed. Press any key to close this window.
  pause >nul
  exit /b 1
)
cd /d C:\Users\User\OneDrive\Desktop\miles\backend
echo Starting EcoLoop server on http://127.0.0.1:5050
echo.
node server.js
echo.
echo Server stopped. Press any key to close this window.
pause >nul
