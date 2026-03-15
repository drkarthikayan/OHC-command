#!/bin/bash
# OHC Command deploy script
# Usage: ./deploy.sh           (deploys from current branch)
#        ./deploy.sh --prod    (merges dev -> main -> deploys)
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$1" == "--prod" ]; then
  echo "==> Merging dev into main..."
  git checkout main
  git pull origin main
  git merge dev --no-edit
  git push origin main
  BRANCH="main"
fi

echo "==> Committing local changes on $BRANCH..."
git add -A
git diff --cached --quiet || git commit -m "chore: local changes"

echo "==> Pulling from GitHub ($BRANCH)..."
git pull --rebase origin $BRANCH
git push origin $BRANCH

echo "==> Installing dependencies..."
npm install

echo "==> Clean build..."
rm -rf dist node_modules/.vite
npm run build

echo "==> Deploying to Firebase..."
firebase deploy --only hosting

echo "==> Done! Cmd+Shift+R to bust cache."
