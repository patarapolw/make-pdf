import fs from 'fs'
import { URL } from 'url'

import express from 'express'
import fetch from 'node-fetch'
import puppeteer from 'puppeteer'

import { router } from './server'
import { deepMerge } from './util'

async function main () {
  const app = express()
  app.use(router)

  const server = app.listen()
  let serverAddress = server.address()
  serverAddress = typeof serverAddress === 'string'
    ? serverAddress
    : `http://localhost:${serverAddress?.port}`

  const browser = await puppeteer.launch({
    headless: true
  })

  const page = await browser.newPage()

  const filename = './index.html'
  await page.goto(new URL(`/${filename}`, serverAddress).href, {
    waitUntil: 'networkidle0'
  })

  /**
   * All possible units are:
   *
   * - px - pixel
   * - in - inch
   * - cm - centimeter
   * - mm - millimeter
   */
  fs.writeFileSync('out.pdf', await page.pdf(deepMerge(
    {
      margin: {
        left: '1in',
        right: '1in',
        top: '0.7in',
        bottom: '0.7in'
      },
      format: 'A4'
    },
    await fetch(new URL(`/${filename}?meta`, serverAddress).href)
      .then((r) => r.json())
      .catch(() => ({}))
  )))

  server.close()
  browser.close()
}

main().catch(console.error)
