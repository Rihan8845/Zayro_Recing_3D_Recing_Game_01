@echo off
cd /d "%~dp0multiplayer-server"
node server.js
if errorlevel 1 pause
