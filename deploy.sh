#!/bin/bash
# OHC Command Deploy Script
# Usage:
#   ./deploy.sh          → deploy current branch to UAT (ohc-portal-uat)
#   ./deploy.sh --prod   → merge dev→main, deploy to Production (ohc-portal-4f2f8)
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$1" == "--prod" ]; then
  echo "==> Switching to main and merging dev..."
  git checkout main
  git pull origin main
  git merge dev --no-edit
  git push origin main
  BRANCH="main"
  ENV_FILE=".env"
  TARGET="prod"
  PROJECT="ohc-portal-4f2f8"
else
  ENV_FILE=".env.uat"
  TARGET="uat"
  PROJECT="ohc-portal-uat"
fi

echo "==> Branch: $BRANCH | Target: $TARGET | Project: $PROJECT"

echo "==> Committing local changes..."
git add -A
git diff --cached --quiet || git commit -m "chore: local changes"

echo "==> Pulling from GitHub ($BRANCH)..."
git pull --rebase origin $BRANCH
git push origin $BRANCH

echo "==> Installing dependencies..."
npm install

echo "==> Clean build with $ENV_FILE..."
rm -rf dist node_modules/.vite
cp $ENV_FILE .env.local 2>/dev/null || true
npm run build

echo "==> Deploying to Firebase $TARGET ($PROJECT)..."
firebase use $PROJECT
firebase deploy --only hosting:$TARGET

echo ""
echo "✅ Deployed to $TARGET!"
if [ "$TARGET" == "prod" ]; then
  echo "   🌐 https://ohc-portal-4f2f8.web.app"
else
  echo "   🧪 https://ohc-portal-uat.web.app"
fi
echo "   Press Cmd+Shift+R to bust cache."
