@echo off
echo === RetailPulse PostgreSQL Setup ===
echo.
echo Attempting to create database and user...
echo.

"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE retailpulse;" 2>nul
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE USER retailpulse WITH PASSWORD 'retailpulse';" 2>nul
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d retailpulse -c "GRANT ALL PRIVILEGES ON DATABASE retailpulse TO retailpulse;" 2>nul

echo.
echo If you see errors above, you may need to enter your PostgreSQL superuser password.
echo.
echo Default PostgreSQL superuser password is often: postgres
echo.
pause
