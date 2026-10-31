#!/usr/bin/env bash
set -e

# ==============================================================================
# RestroAstra VPS Deployment Script (Isolated)
# Tagline: One platform. Every restaurant operation.
# ==============================================================================

echo "======================================================"
echo "  Deploying RestroAstra Application (Isolated)        "
echo "  Target Port: 3005 | Process: restroastra-app        "
echo "======================================================"

# CRITICAL SAFETY CHECK: Never deploy inside original live application folder
CURRENT_DIR="$(pwd)"
if [[ "$CURRENT_DIR" == *"digitalize-nepal"* ]] || [[ "$CURRENT_DIR" == *"/var/www/digitalizemenu"* ]]; then
    echo ">> [FATAL SAFETY ERROR] You are attempting to run deployment inside the original live directory!"
    echo ">> Execution aborted immediately to protect the live site."
    exit 1
fi

# Ensure uploads directory exists with correct permissions
mkdir -p public/uploads
mkdir -p logs
chmod -R 775 public/uploads logs || true

# Prepare Prisma schema according to database provider in .env
if [ -f "prisma/schema.postgresql.prisma" ] && grep -q "postgres" .env 2>/dev/null; then
    echo ">> PostgreSQL database detected in .env. Preparing PostgreSQL schema..."
    cp prisma/schema.postgresql.prisma prisma/schema.prisma
else
    echo ">> SQLite database detected in .env. Preserving SQLite schema..."
fi

# 1. Docker Compose deployment (isolated project namespace: restroastra)
if command -v docker-compose &> /dev/null && [ -f "docker-compose.yml" ] && [ "${USE_DOCKER}" = "true" ]; then
    echo ">> Detected Docker Compose setup."
    echo ">> Building and restarting RestroAstra containers..."
    docker-compose -p restroastra up -d --build web
    echo ">> Syncing database schema..."
    docker-compose -p restroastra exec -T web npx prisma db push || true
    echo ">> RestroAstra Docker deployment successful!"
    exit 0
fi

# 2. PM2 deployment (isolated process: restroastra-app on port 3005)
if command -v pm2 &> /dev/null; then
    echo ">> Detected PM2 process manager."
    npm install
    npx prisma generate
    npx prisma db push
    npm run build
    
    # Reload or start ONLY restroastra-app
    if pm2 describe restroastra-app > /dev/null 2>&1; then
        echo ">> Reloading running restroastra-app process..."
        pm2 reload restroastra-app
    else
        echo ">> Starting new restroastra-app process..."
        pm2 start ecosystem.config.js --only restroastra-app
    fi
    pm2 save || true
    echo ">> RestroAstra PM2 deployment successful on internal port 3005!"
    exit 0
fi

# 3. Direct Node.js rebuild
echo ">> Running standard Node.js build..."
npm install
npx prisma generate
npx prisma db push
npm run build
echo ">> Build complete! Start with: PORT=3005 node server.js"
