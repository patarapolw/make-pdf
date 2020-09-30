import fs from 'fs'
import http from 'http'
import path from 'path'

import express from 'express'
import morgan from 'morgan'
import puppeteer, { Browser, PDFOptions } from 'puppeteer'

import { MakeHtml } from './make-html'
import { matter } from './make-html/matter'
import { deepMerge } from './util'

export async function makeFileServer (port = 0, { cwd }: {
  cwd: string
}): Promise<{
  server: http.Server
  browser: Browser
  close(): Promise<void>
  baseURL(): string
}> {
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
        } else if (format === 'pdf') {
          const { data } = matter.parse(
            fs.readFileSync(filepath, 'utf-8')
          ).data

          const pdfConfig = deepMerge<PDFOptions>({
            margin: {
              left: '1in',
              right: '1in',
              top: '0.7in',
              bottom: '0.7in'
            },
            format: 'A4',
            printBackground: true
          }, data)

          const page = await browser.newPage()

          const addr = srv.address()
          const url = new URL(`${req.path}?format=html`, typeof addr === 'string'
            ? addr
            : `http://localhost:${addr?.port}`).href

          await page.goto(url, {
            waitUntil: 'networkidle0'
          })

          console.log(page)

          res.contentType('application/pdf')
          const b = await page.pdf(pdfConfig)
          await page.close()
          res.send(b)
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
  const browser = await puppeteer.launch({
    headless: true
  })

  return {
    server: srv,
    browser,
    async close () {
      await Promise.all([
        srv.close(),
        browser.close()
      ])
    },
    baseURL () {
      const addr = srv.address()
      return typeof addr === 'string'
        ? addr
        : `http://localhost:${addr ? addr.port : null}`
    }
  }
}
