@echo off
REM 雙擊即可啟動 DB 跳板通道；也可帶參數: db-tunnel.cmd stop / status / restart
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0db-tunnel.ps1" %*
pause
