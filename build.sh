#! /bin/sh

pushd src
`npm bin`/watchify index.js \
  --verbose \
  -o './node_modules/.bin/exorcist ../index.js.map > ../index.js' \
  --debug
popd