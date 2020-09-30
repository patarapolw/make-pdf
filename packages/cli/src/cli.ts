#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

import express from 'express'
import yaml from 'js-yaml'
import S, { ObjectSchema } from 'jsonschema-definer'
import morgan from 'morgan'
import fetch from 'node-fetch'
import open from 'open'
import { PDFDocument } from 'pdf-lib'
import { Browser, PDFOptions } from 'puppeteer'
import yargs from 'yargs'

import { validateDate, validateTag } from './make-html/validate'
import { makeFileServer } from './server'
import { deepMerge } from './util'

async function main () {
  const pkg = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../package.json'), 'utf-8'
  ))

  const { argv } = yargs
    .scriptName('makepdf')
    .version(pkg.version || '0.0.0')
    .usage(
      `$0 <...files> [...opts] - ${pkg.description}`
    )
    .check((argv) => {
      if (argv._.length < 1) {
        throw new Error('At least one file must be passed.')
      }

      argv._ = argv._.map((f) => path.resolve(process.cwd(), f))

      if (!argv.root) {
        let segs = argv._.map((f) => f.split(path.sep))
        const base = segs[0][0]

        segs = segs.map(([, ...s]) => s)
        const maxLength = Math.max(...segs.map((s) => s.length))

        const p = Array(maxLength).fill(null).map((_, i) => {
          const allS = segs
            .map((s) => s[i])
            .filter((s) => s)
          if (allS.every((s) => s === allS[0])) {
            return allS[0]
          }
          return ''
        }).filter((s) => s)

        if (p.length === maxLength) {
          p.pop()
        }

        argv.root = `${base}${path.sep}${p.join(path.sep)}`
      }

      return true
    })
    .option('output', {
      alias: 'o',
      describe: 'Output PDF filename',
      type: 'string'
    })
    .option('port', {
      alias: 'p',
      describe: 'Choose a port to preview PDF',
      default: 28515
    })
    .option('root', {
      alias: 'r',
      describe: 'Root to run server from',
      type: 'string'
    })
    .option('config', {
      alias: 'c',
      describe: 'Path to config file, or config in JSON form',
      type: 'string'
    })
    .option('preview', {
      describe: 'Preview in browser',
      type: 'boolean'
    })

  const outFile = argv._[0].replace(/\.[A-Za-z0-9]+$/, '') + '.pdf'

  const cwd = argv.root as string
  const files = argv._.map((f) => path.relative(cwd, f))
  const sConfig = S.shape({
    metadata: S.shape({
      title: S.string().optional(),
      author: S.string().optional(),
      subject: S.string().optional(),
      keywords: S.list(S.string()).optional(),
      producer: S.string().optional(),
      creator: S.string().optional(),
      creationDate: S.string().optional(),
      modificationDate: S.string().optional()
    }).optional(),
    printingOptions: S.object()
      .additionalProperties(true)
      .optional() as ObjectSchema<PDFOptions, false>
  })

  const { metadata = {}, printingOptions = {} } = ((): typeof sConfig.type => {
    try {
      return sConfig.ensure(yaml.safeLoad(fs.readFileSync(
        path.resolve(cwd, argv.config || 'config.yaml'),
        'utf-8'
      ), {
        schema: yaml.JSON_SCHEMA
      }) as typeof sConfig.type)
    } catch (_) {}

    return {}
  })()

  const fileServer = await makeFileServer(0, { cwd })

  const app = express()
  if (process.env.DEBUG) {
    app.use(morgan('combined'))
  }

  app.get('/file/*', (req, res) => {
    const url = new URL(`/${req.url.replace(/^\/file\//, '')}`,
      fileServer.baseURL())
    res.redirect(url.href)
  })

  app.get('/', (req, res, next) => {
    const { file } = req.query

    const [f0, ...otherFiles] = Array.isArray(file)
      ? file as string[]
      : typeof file === 'string'
        ? [file]
        : files

    combinePDF(f0, ...otherFiles)
      .then((b) => {
        res.contentType('application/pdf')
        res.write(b)
        res.end()
      })
      .catch((e) => next(e))
  })

  app.use(express.static(path.resolve(__dirname, '../public')))

  const srv = app.listen(argv.port, () => {
    const addr = srv.address()
    const url = typeof addr === 'string'
      ? addr
      : `http://localhost:${addr ? addr.port : null}`

    if (argv.preview) {
      open(url)
    }

    if (process.env.DEBUG) {
      console.info(`Dev server at ${url}`)
    }
  })

  if (argv.preview) {
    return
  }

  async function combinePDF (f0: string, ...otherFiles: string[]) {
    const baseURL = fileServer.baseURL()
    const pdf = await PDFDocument.load(await getPdf(fileServer.browser, f0, {
      baseURL,
      printingOptions
    }))

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

    for (const f of otherFiles) {
      await PDFDocument
        .load(await getPdf(fileServer.browser, f, {
          baseURL,
          printingOptions
        }))
        .then((seg) => pdf.copyPages(
          seg,
          Array.from({
            length: seg.getPageCount()
          }, (_, i) => i)))
        .then((ps) => {
          ps.map((p) => pdf.addPage(p))
        })
    }

    return pdf.save()
  }

  const [f0, ...otherFiles] = files
  fs.writeFileSync(outFile, await combinePDF(f0, ...otherFiles))

  srv.close()
  fileServer.close()
}

async function getPdf (browser: Browser, f: string, {
  baseURL,
  printingOptions
}: {
  baseURL: string,
  printingOptions: PDFOptions
}): Promise<Buffer> {
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

  const page = await browser.newPage()

  await page.goto(new URL(`/${f}?format=pdf`, baseURL).href, {
    waitUntil: 'networkidle0'
  })

  const b = await page.pdf(deepMerge(
    pdfConfig,
    await fetch(new URL(`/${f}?format=meta`, baseURL).href)
      .then((r) => r.json())
      .catch(() => ({}))
  ))

  await page.close()

  return b
}

if (require.main === module) {
  main().catch(console.error)
}
