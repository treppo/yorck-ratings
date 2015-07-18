#! /bin/sh

./node_modules/.bin/watchify src/index.js \
  --verbose \
  -o './node_modules/.bin/exorcist dist/index.js.map > dist/index.js' \
  --debug
