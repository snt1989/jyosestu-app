#!/bin/sh
# src/ の部品をつなげて index.html を作ります。  使い方:  sh build.sh
set -e
cd "$(dirname "$0")"
{
  echo '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>'
  echo '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>'
  echo '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>'
  echo '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js"></script>'
  echo '<script src="/firebase-config.js"></script><script src="/fb-shim.js"></script>'
  cat src/p1.html
  echo '</head><body>'
  cat src/p2.html src/p3a.js src/p3b.js src/p3c.js src/p3d.js
  echo '</body></html>'
} > index.html
echo "index.html を作りました"
