# RetailPulse Analytics - PostgreSQL Setup Script for Windows
# Run this script as Administrator in PowerShell

Write-Host "=== RetailPulse PostgreSQL Setup ===" -ForegroundColor Cyan

# Check if PostgreSQL service is running
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pgService) {
    Write-Host "ERROR: PostgreSQL service not found. Please install PostgreSQL first." -ForegroundColor Red
    exit 1
}

Write-Host "PostgreSQL service found: $($pgService.Name)" -ForegroundColor Green
Write-Host "Status: $($pgService.Status)" -ForegroundColor Green

if ($pgService.Status -ne "Running") {
    Write-Host "Starting PostgreSQL service..." -ForegroundColor Yellow
    Start-Service $pgService.Name
    Start-Sleep -Seconds 3
}

# PostgreSQL paths
$pgBin = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

# Try to create database and user
Write-Host "`nAttempting to create database and user..." -ForegroundColor Yellow

# Method 1: Try with postgres user and no password (trust auth)
try {
    & $pgBin -U postgres -c "CREATE DATABASE retailpulse;" 2>&1 | Out-Null
    Write-Host "Database 'retailpulse' created or already exists." -ForegroundColor Green
} catch {
    Write-Host "Method 1 failed, trying with password...`nNOTE: If prompted, enter your PostgreSQL superuser password." -ForegroundColor Yellow
    
    # Method 2: Try with common passwords or prompt user
    $passwords = @("postgres", "admin", "password", "")
    $success = $false
    
    foreach ($pwd in $passwords) {
        try {
            $env:PGPASSWORD = $pwd
            & $pgBin -U postgres -c "SELECT 1;" 2>&1 | Out-Null
            $success = $true
            break
        } catch {
            continue
        }
    }
    
    if (-not $success) {
        Write-Host "`nCould not authenticate automatically." -ForegroundColor Red
        Write-Host "Please run this command manually in a new PowerShell window:" -ForegroundColor Yellow
        Write-Host "  `$env:PGPASSWORD = 'your_postgres_password'" -ForegroundColor Cyan
        Write-Host "  & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -c `"CREATE DATABASE retailpulse;`"" -ForegroundColor Cyan
        Write-Host "  & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -c `"CREATE USER retailpulse WITH PASSWORD 'retailpulse';`"" -ForegroundColor Cyan
        Write-Host "  & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d retailpulse -c `"GRANT ALL PRIVILEGES ON DATABASE retailpulse TO retailpulse;`"" -ForegroundColor Cyan
        exit 1
    }
}

# Create user and grant privileges
$env:PGPASSWORD = "postgres"
try {
    & $pgBin -U postgres -c "CREATE USER retailpulse WITH PASSWORD 'retailpulse';" 2>&1 | Out-Null
    Write-Host "User 'retailpulse' created or already exists." -ForegroundColor Green
} catch {
    Write-Host "User may already exist." -ForegroundColor Yellow
}

try {
    & $pgBin -U postgres -d retailpulse -c "GRANT ALL PRIVILEGES ON DATABASE retailpulse TO retailpulse;" 2>&1 | Out-Null
    Write-Host "Privileges granted to 'retailpulse'." -ForegroundColor Green
} catch {
    Write-Host "Could not grant privileges. You may need to do this manually." -ForegroundColor Yellow
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host "Database URL: postgresql+asyncpg://retailpulse:retailpulse@localhost:5432/retailpulse" -ForegroundColor Cyan
Write-Host "`nYou can now start the backend with: uvicorn app.main:app --reload" -ForegroundColor Green
