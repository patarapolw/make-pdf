import fs from 'fs'
import http from 'http'
import path from 'path'

import { BrowserWindow, PrintToPDFOptions, app as electron } from 'electron'
import express from 'express'
import morgan from 'morgan'

import { MakeHtml } from './make-html'
import { matter } from './make-html/matter'
import { deepMerge } from './util'

let pdfConfig: PrintToPDFOptions = {}

async function main () {
  let port = parseInt(process.env.PORT || '0')
  let cwd = process.cwd()

  if (process.env.config) {
    try {
      const msg = JSON.parse(process.env.config)
      port = msg.port
      cwd = msg.cwd
      pdfConfig = msg.pdfConfig
    } catch (e) {
      console.error(e)
    }
  }

  await electron.whenReady()

  const srv = makeFileServer(port, { cwd })

  process.openStdin()
    .write(JSON.stringify({ type: 'ready', baseURL: srv.baseURL }))
}

export function makeFileServer (port = 0, { cwd }: {
  cwd: string
}): {
  app: express.Express
  server: http.Server
  baseURL: string
} {
  const app = express()

  if (process.env.DEBUG) {
    app.use(morgan('combined'))
  }

  if (!path.isAbsolute(cwd)) {
    cwd = path.resolve(process.cwd(), cwd)
  }

  app.get('/*', async (req, res, next) => {
    try {
      const filepath = req.path.endsWith('/')
        ? path.resolve(cwd, req.path.substr(1), 'index.html')
        : path.resolve(cwd, req.path.substr(1))

      if (!fs.existsSync(filepath)) {
        next()
        return
      }

      const format = req.query.format as string
      const base = (/\.[a-z]+$/.exec(req.path.toLocaleLowerCase()) || [])[0] || ''

      if (['.md', '.markdown'].includes(base)) {
        if (format === 'meta') {
          res.json(matter.parse(
            fs.readFileSync(filepath, 'utf-8')
          ).data)
          return
        }

        if (format === 'html') {
          const makeHtml = new MakeHtml(filepath)
          res.contentType('html')
          res.send(makeHtml.render(
            fs.readFileSync(filepath, 'utf-8')
          ))
          return
        } else if (typeof electron !== 'undefined' && format === 'pdf') {
          const { data } = matter.parse(
            fs.readFileSync(filepath, 'utf-8')
          )

          const addr = srv.address()
          const url = new URL(`${req.path}?format=html`, typeof addr === 'string'
            ? addr
            : `http://localhost:${addr?.port}`).href

          const win = new BrowserWindow({
            show: false
          })

          win.loadURL(url)

          await new Promise((resolve, reject) => {
            win.webContents.once('did-finish-load', () => {
              win.webContents.printToPDF(
                deepMerge(pdfConfig, data)
              )
                .then((b) => {
                  res.contentType('application/pdf').send(b)
                  resolve()
                })
                .catch(reject)
            })
          })

          win.close()

          return
        }
      }

      res.sendFile(filepath)
    } catch (e) {
      next(e)
    }
  })

  app.get('/favicon.ico', (_, res) => res.send(''))

  const srv = app.listen(port)

  return {
    app,
    server: srv,
    baseURL: (() => {
      const addr = srv.address()
      return typeof addr === 'string'
        ? addr
        : `http://localhost:${addr ? addr.port : null}`
    })()
  }
}

if (require.main === module) {
  main().catch(console.error)
}
