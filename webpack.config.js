// @ts-check
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs')
const path = require('path')
const { URL } = require('url')

const { default: fetch } = require('node-fetch')
const glob = require('globby')
const yaml = require('js-yaml')
const z = require('zod')

const userRoot = './in'

const zConfig = z.object({
  table: z.record(z.any()).optional(),
  fonts: z.record(z.record(z.string())).optional()
})

process.env.PORT = process.env.PORT || '8080'
const PORT = parseInt(process.env.PORT)

/**
 * @type {import('webpack').Configuration}
 */
const config = {
  entry: {
    index: path.resolve('./src/index.ts')
  },
  devServer: {
    port: PORT,
    contentBase: [
      path.resolve('public'),
      path.resolve(userRoot),
      path.resolve('src')
    ],
    watchContentBase: true,
    before (app) {
      app.get('/api/config', (_, res) => {
        try {
          let config = {}

          const p = path.resolve(userRoot, 'config.yaml')
          if (fs.existsSync(p)) {
            config = zConfig.parse(
              yaml.safeLoad(fs.readFileSync(p, 'utf8'))
            )
          }

          res.send(config)
        } catch (e) {
          res.status(500).send(e.message || e)
        }
      })

      app.get('/api/pdf', (_, res) => {
        try {
          let p

          // eslint-disable-next-line prefer-const
          p = path.resolve(userRoot, 'pdf.yaml')
          if (fs.existsSync(p)) {
            res.json(
              yaml.safeLoad(fs.readFileSync(p, 'utf8'))
            )
            return
          }

          throw new Error('Cannot read doc materials')
        } catch (e) {
          console.error(e)
          res.status(500).send(e.message || e)
        }
      })

      app.get('/api/files', (_, res) => {
        res.json({
          files: glob.sync('**/*.{jpg,jpeg,png,gif}', {
            cwd: path.resolve(userRoot)
          })
        })
      })

      app.get('/api/base64', async (req, res, next) => {
        try {
          if (!req.query.url) {
            next()
            return
          }

          const b = await fetch(new URL(
            /** @type {string} */ (req.query.url),
            `http://localhost:${PORT}`)).then((r) => r.arrayBuffer())

          res.send(Buffer.from(b).toString('base64'))
        } catch (e) {
          next(e)
        }
      })

      app.get('/favicon.ico', (_, res) => res.send(''))
    }
  },
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: ['.ts', '.tsx', '.js']
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: 'ts-loader' }
    ]
  }
}

module.exports = config
