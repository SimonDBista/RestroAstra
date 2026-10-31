param (
    [string]$VpsHost = "YOUR_VPS_IP",
    [string]$VpsUser = "root",
    [string]$RemotePath = "/var/www/restroastra"
)

# ==============================================================================
# RestroAstra VPS Sync & Deployment Script (Strictly Isolated)
# Tagline: One platform. Every restaurant operation.
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   RestroAstra VPS Synchronization & Deployment           " -ForegroundColor Cyan
Write-Host "   Target: ${VpsUser}@${VpsHost}:${RemotePath}            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# CRITICAL SAFETY GUARD: Prevent deployment to original live site path
if ($RemotePath -like "*digitalize-nepal*" -or $RemotePath -like "*digitalizemenu*") {
    Write-Host "`n[FATAL ERROR] Target path matches original live website!" -ForegroundColor Red
    Write-Host "RestroAstra must be deployed exclusively to its own directory: /var/www/restroastra" -ForegroundColor Yellow
    exit 1
}

if ($VpsHost -eq "YOUR_VPS_IP") {
    Write-Host "`n[NOTICE] Please provide your target VPS host IP with -VpsHost <ip>" -ForegroundColor Yellow
    Write-Host "Example: .\sync-to-vps.ps1 -VpsHost 169.58.213.137 -RemotePath /var/www/restroastra`n" -ForegroundColor Yellow
    exit 1
}

$confirmation = Read-Host "Are you sure you want to deploy RestroAstra to ${VpsHost}:${RemotePath}? (y/N)"
if ($confirmation -ne "y" -and $confirmation -ne "Y") {
    Write-Host "Deployment aborted by user." -ForegroundColor Yellow
    exit 0
}

# Create remote isolated directory structure on VPS if not exists
Write-Host "`n>> Initializing remote directory: ${RemotePath}..." -ForegroundColor Yellow
ssh "${VpsUser}@${VpsHost}" "mkdir -p ${RemotePath} ${RemotePath}/logs ${RemotePath}/public/uploads"

$filesToSync = @(
    "src",
    "public",
    "prisma",
    "server.js",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tailwind.config.js",
    "postcss.config.mjs",
    "next.config.mjs",
    "ecosystem.config.js",
    "nginx-vps.conf",
    "deploy-vps.sh",
    ".env.example",
    "Dockerfile",
    "docker-compose.yml",
    ".gitignore",
    "README.md"
)

foreach ($file in $filesToSync) {
    if (Test-Path $file) {
        Write-Host ">> Transferring $file..." -ForegroundColor Yellow
        scp -r $file "${VpsUser}@${VpsHost}:${RemotePath}/$file"
    }
}

Write-Host "`n>> Running remote isolated deployment script on VPS..." -ForegroundColor Green
ssh "${VpsUser}@${VpsHost}" "cd $RemotePath && chmod +x deploy-vps.sh && ./deploy-vps.sh"

Write-Host "`nRestroAstra successfully synchronized and deployed to VPS!" -ForegroundColor Green
