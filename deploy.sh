#!/bin/bash
# OHC Command deploy script — Usage: ./deploy.sh
set -e
echo '==> Committing local changes...'
git add -A
git diff --cached --quiet || git commit -m 'chore: local changes'
echo '==> Pulling from GitHub...'
git pull --rebase origin main
echo '==> Installing dependencies...'
npm install
echo '==> Clean build...'
rm -rf dist node_modules/.vite
npm run build
echo '==> Deploying...'
firebase deploy --only hosting
echo '==> Done! Press Cmd+Shift+R in browser'