#! /bin/sh

pushd src
`npm bin`/watchify index.js \
  -o './node_modules/.bin/exorcist ../index.js.map > ../index.js' \
  --verbose \
  --debug \
  --transform [ babelify --presets [ es2015 ] ]
popd