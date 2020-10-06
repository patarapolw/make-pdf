// @ts-check
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')

const isDevServer = process.env.WEBPACK_DEV_SERVER

/**
 * @type {import('webpack').Configuration}
 */
const config = {
  mode: isDevServer ? 'development' : 'production',
  entry: {
    'md-to-img': path.resolve('./src/md-to-img.ts'),
    ...(isDevServer ? {
      main: path.resolve('./src/main.ts')
    } : {})
  },
  output: {
    path: path.resolve('../cli/public')
  },
  devServer: {
    contentBase: path.resolve('./public')
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader' },
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          'style-loader',
          // Translates CSS into CommonJS
          'css-loader',
          // Compiles Sass to CSS
          'sass-loader'
        ]
      },
      {
        test: /\.css$/i,
        use: [
          'style-loader',
          'css-loader'
        ]
      }
    ]
  }
}

module.exports = config
