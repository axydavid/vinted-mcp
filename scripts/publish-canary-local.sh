#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ORIG_VERSION="$(node -p "require('./package.json').version")"

BASE_VERSION="$(node -e "const v=require('./package.json').version||'0.0.0'; const c=String(v).replace(/^v/,'').split('+')[0].split('-')[0]; const p=c.split('.'); while(p.length<3)p.push('0'); process.stdout.write(p.slice(0,3).join('.'));")"
SUFFIX="${1:-$(date +%Y%m%d%H%M%S)}"
CANARY_VERSION="${BASE_VERSION}-next.${SUFFIX}"

restore_version() {
  npm pkg set "version=${ORIG_VERSION}" >/dev/null
}

trap restore_version EXIT

echo "Setting canary version: ${CANARY_VERSION}"
npm version "$CANARY_VERSION" --no-git-tag-version >/dev/null

echo "Building and testing"
npm run build
npm run bundle
npm test

echo "Publishing canary"
if [[ -n "${NPM_OTP:-}" ]]; then
  npm publish --tag next --access public --otp "$NPM_OTP"
else
  npm publish --tag next --access public
fi

echo "Canary publish completed"
