import { URL } from 'url'

import express from 'express'
import puppeteer from 'puppeteer'

import { router } from '../src/server'

async function main () {
  const f = '100.md'

  const app = express()
  app.use(router)

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const srv = app.listen(() => {
      resolve(srv)
    })
  })
  let serverAddress = server.address()
  serverAddress = typeof serverAddress === 'string'
    ? serverAddress
    : `http://localhost:${serverAddress?.port}`

  const browser = await puppeteer.launch({
    headless: false
  })

  const page = await browser.newPage()

  await page.goto(new URL(`/${f}?format=html`, serverAddress).href, {
    waitUntil: 'networkidle0'
  })

  browser.once('targetdestroyed', () => {
    server.close()
  })
}

main().catch(console.error)
