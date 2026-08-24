@echo off
title GH Pro — Servidor Local
echo.
echo  ================================
echo   GH Pro — Servidor Local
echo  ================================
echo.
echo  Iniciando servidor en http://localhost:3000
echo  Presiona Ctrl+C para detener
echo.
npx --yes http-server . -p 3000 -c-1 --cors -o
pause
