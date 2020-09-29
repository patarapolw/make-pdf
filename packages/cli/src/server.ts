import fs from 'fs'
import http from 'http'
import path from 'path'

import express from 'express'
import morgan from 'morgan'
import puppeteer, { PDFOptions } from 'puppeteer'

import { MakeHtml } from './make-html'
import { matter } from './make-html/matter'
import { deepMerge } from './util'

export function makeFileServer (port = 0, { userIn }: {
  userIn: string
}): http.Server {
  const app = express()
  app.use(morgan('common'))

  app.get('/*', async (req, res, next) => {
    try {
      const format = req.query.format as string
      const filepath = path.resolve(process.cwd(), userIn, req.path.substr(1))

      if (!fs.existsSync(filepath)) {
        next()
        return
      }

      if (format === 'meta') {
        res.json(matter.parse(
          fs.readFileSync(filepath, 'utf-8')
        ).data)
        return
      } else if (format === 'html') {
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

        const browser = await puppeteer.launch({
          headless: true
        })

        const page = await browser.newPage()

        const addr = srv.address()
        await page.goto(new URL(`${req.path}?format=html`, typeof addr === 'string'
          ? addr
          : `http://localhost:${addr?.port}`).href, {
          waitUntil: 'networkidle0'
        })

        res.contentType('application/pdf')
        res.send(await page.pdf(pdfConfig))

        page.close()
        browser.close()
        return
      }

      res.sendFile(filepath)
    } catch (e) {
      next(e)
    }
  })

  app.get('/favicon.ico', (_, res) => res.send(''))

  const srv = app.listen(port)
  return srv
}
