var webpack = require('webpack');

module.exports = {
  entry: "./index",
  output: {
    path: __dirname + "/..",
    filename: "index.js"
  },
  debug: true,
  watch: true,
  devtool: 'source-map',
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel',
        query: {
          presets: ['es2015']
        }
      }
    ]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: true,
        screw_ie8: true
      }
    })
  ]
};
