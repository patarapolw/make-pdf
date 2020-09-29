import fs from 'fs'
import path from 'path'
import { URL } from 'url'

import express from 'express'
import glob from 'globby'
import yaml from 'js-yaml'
import fetch from 'node-fetch'
import { PDFDocument } from 'pdf-lib'
import puppeteer, { PDFOptions } from 'puppeteer'

import { sConfig, userIn, userOut } from './config'
import { validateDate, validateTag } from './make-html/validate'
import { router } from './server'
import { naturalSort } from './sort'
import { deepMerge } from './util'

async function main () {
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

  const { metadata = {}, printingOptions = {} } = ((): typeof sConfig.type => {
    try {
      return sConfig.ensure(yaml.safeLoad(fs.readFileSync(
        path.resolve(userIn, 'config.yaml'),
        'utf-8'
      ), {
        schema: yaml.JSON_SCHEMA
      }) as typeof sConfig.type)
    } catch (_) {}

    return {}
  })()

  const pdf = await PDFDocument.create()
  if (metadata.title) {
    pdf.setTitle(metadata.title)
  }
  if (metadata.author) {
    pdf.setAuthor(metadata.author)
  }
  if (metadata.subject) {
    pdf.setSubject(metadata.subject)
  }
  if (metadata.keywords) {
    const keywords = validateTag(metadata.keywords)
    if (keywords) {
      pdf.setKeywords(keywords)
    }
  }
  if (metadata.producer) {
    pdf.setProducer(metadata.producer)
  }
  if (metadata.creator) {
    pdf.setCreator(metadata.creator)
  }

  metadata.creationDate = (metadata.creationDate
    ? validateDate(metadata.creationDate) : '') || new Date().toISOString()

  pdf.setCreationDate(new Date(metadata.creationDate))

  metadata.modificationDate = (metadata.creationDate
    ? validateDate(metadata.creationDate) : '') || metadata.creationDate

  pdf.setModificationDate(new Date(metadata.modificationDate))

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
  }, printingOptions)

  const browser = await puppeteer.launch({
    headless: true
  })

  const page = await browser.newPage()

  for (const f of (await glob('*.md', {
    cwd: userIn
  })).sort(naturalSort)) {
    await page.goto(new URL(`/${f}?format=html`, serverAddress).href, {
      waitUntil: 'networkidle0'
    })

    const pages = await PDFDocument
      .load(await page.pdf(deepMerge(
        pdfConfig,
        await fetch(new URL(`/${f}?format=meta`, serverAddress as string).href)
          .then((r) => r.json())
          .catch(() => ({}))
      )))
      .then((seg) => pdf.copyPages(
        seg,
        Array.from({
          length: seg.getPageCount()
        }, (_, i) => i)))

    pages.map((p) => pdf.addPage(p))
  }

  fs.writeFileSync(path.resolve(userOut, 'out.pdf'), await pdf.save())

  server.close()
  browser.close()
}

main().catch(console.error)
