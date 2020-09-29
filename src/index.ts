import fs from 'fs'
import { URL } from 'url'

import express from 'express'
import glob from 'globby'
import { jsPDF as PDF, jsPDFOptions } from 'jspdf'
import fetch from 'node-fetch'
import puppeteer, { PDFOptions } from 'puppeteer'

import { userRoot } from './config'
import { router } from './server'
import { deepMerge } from './util'

async function main () {
  const app = express()
  app.use(router)

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    app.listen(() => {
      resolve(server)
    })
  })
  let serverAddress = server.address()
  serverAddress = typeof serverAddress === 'string'
    ? serverAddress
    : `http://localhost:${serverAddress?.port}`

  const config: {
    jsPDF: jsPDFOptions
    chrome: PDFOptions
  } = await fetch(new URL('/config', serverAddress).href)
    .then((r) => r.json())

  /**
   * All possible units are:
   *
   * - px - pixel
   * - in - inch
   * - cm - centimeter
   * - mm - millimeter
   */
  const pdfConfig = deepMerge<PDFOptions>({
    margin: {
      left: '1in',
      right: '1in',
      top: '0.7in',
      bottom: '0.7in'
    },
    format: 'A4'
  }, config.chrome)

  const pdf = new PDF(config.jsPDF)

  const browser = await puppeteer.launch({
    headless: true
  })

  const page = await browser.newPage()

  const filename = './index.html'
  await page.goto(new URL(`/${filename}`, serverAddress).href, {
    waitUntil: 'networkidle0'
  })

  await glob('*.md', {
    cwd: userRoot
  }).then((files) => Promise.all(files.map(async (f) => {
    pdf.fromHTML(await page.pdf(deepMerge(
      pdfConfig,
      await fetch(new URL(`/${f}?meta`, serverAddress).href)
        .then((r) => r.json())
        .catch(() => ({}))
    )))
  })))

  pdf.save('out.pdf')

  server.close()
  browser.close()
}

main().catch(console.error)
