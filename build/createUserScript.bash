#! /bin/bash
set -eu -o pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

APP_TYPE="$1"

case "$APP_TYPE" in
  integrated) APP_MODULE_NAME='integratedApp' ;;
  external) APP_MODULE_NAME='externalApp' ;;
  *) echo $"Usage: ${BASH_SOURCE[0]} {integrated|external}"; exit 1
esac

mkdir -p ../bin

(
  cat userScriptHeader.js | sed "s/@@@APP_TYPE@@@/$APP_TYPE/"
  cat amdAppHeader.js.txt
  cat amdLoader.js
  cat ../out/out.js
  echo "await require('$APP_MODULE_NAME').run();"
  cat amdAppFooter.js.txt
) > "../bin/pianoMarvelEnhancements.$APP_TYPE.user.js"