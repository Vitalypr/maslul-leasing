#!/usr/bin/env bash
# Build and publish to GitHub Pages.
#
#   bash scripts/deploy.sh
#
# Two things here are not obvious and both caused a failure once:
#
# 1. BASE_PATH has NO leading slash. Git Bash rewrites a leading "/" into a
#    Windows path, so "/maslul-leasing/" became "/C:/Program Files/Git/...".
#    src/pwa/manifest.ts adds the slash itself.
#
# 2. The branch is built with plumbing rather than a second clone. A standalone
#    repo did not inherit the credential helper and the push hung on a prompt
#    that never appeared in the terminal.
set -euo pipefail

REPO_NAME="maslul-leasing"
REMOTE="origin"
BRANCH="gh-pages"

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "building for /$REPO_NAME/ ..."
BASE_PATH="$REPO_NAME" npm run build

echo "assembling $BRANCH ..."
touch dist/.nojekyll
export GIT_DIR="$ROOT/.git"
export GIT_WORK_TREE="$ROOT/dist"
export GIT_INDEX_FILE="$ROOT/.git/deploy-index"
rm -f "$GIT_INDEX_FILE"
( cd dist && git add -A -f . )
TREE=$(git write-tree)
COMMIT=$(git commit-tree "$TREE" -m "deploy: built site")
git update-ref "refs/heads/$BRANCH" "$COMMIT"
rm -f "$GIT_INDEX_FILE"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

echo "pushing ..."
GIT_TERMINAL_PROMPT=0 git push "$REMOTE" "$BRANCH:$BRANCH" --force

echo
echo "done — https://vitalypr.github.io/$REPO_NAME/"
echo "Pages can take a minute to pick up the change."
