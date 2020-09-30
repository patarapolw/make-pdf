#!/usr/bin/env node

import { fork } from 'child_process'
import fs from 'fs'
import path from 'path'

import { PrintToPDFOptions } from 'electron'
import express from 'express'
import yaml from 'js-yaml'
import S, { ObjectSchema } from 'jsonschema-definer'
import morgan from 'morgan'
import fetch from 'node-fetch'
import open from 'open'
import { PDFDocument } from 'pdf-lib'
import yargs from 'yargs'

import { validateDate, validateTag } from './make-html/validate'
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

  const cwd = argv.root || process.cwd()

  const files = argv._.map((f) => path.relative(cwd, f))
  const outFile = argv._[0].replace(/\.[A-Za-z0-9]+$/, '') + '.pdf'

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
    options: S.object()
      .additionalProperties(true)
      .optional() as ObjectSchema<PrintToPDFOptions, false>
  })

  const { metadata = {}, options = {} } = ((): typeof sConfig.type => {
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

  /**
   * All possible units are:
   *
   * - px - pixel
   * - in - inch
   * - cm - centimeter
   * - mm - millimeter
   */
  const pdfConfig = deepMerge<PrintToPDFOptions>({
    marginsType: 50,
    pageSize: 'A4'
  }, options)

  const electron = fork(path.resolve(__dirname, './server.js'), {
    stdio: ['pipe', 'inherit', 'inherit', 'ipc'],
    execPath: path.resolve(__dirname, '../node_modules/.bin/electron'),
    env: {
      ...process.env,
      config: JSON.stringify({
        port: argv.preview ? argv.port : 0,
        cwd,
        pdfConfig
      })
    }
  })

  let electronBaseURL = 'http://localhost'

  await new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    electron.stdin!.on('data', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString('utf8'))

        if (argv.preview) {
          const url = new URL(
          `/${path.relative(cwd, argv._[0])}?format=pdf`,
          msg.baseURL
          ).href

          open(url)
        } else {
          electronBaseURL = msg.baseURL
        }
        resolve()
      } catch (e) {
        console.error(e)
      }
    })
  })

  if (argv.preview) {
    return
  }

  const app = express()

  if (process.env.DEBUG) {
    app.use(morgan('combined'))
  }

  app.get('/file/*', (req, res) => {
    const url = new URL(`/${req.url.replace(/^\/file\//, '')}`,
      electronBaseURL)
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
    const pdf = await PDFDocument.load(
      await fetch(new URL(`/${f0}?format=pdf`, electronBaseURL).href)
        .then((r) => r.buffer())
    )

    console.log(new URL(`/${f0}?format=pdf`, electronBaseURL).href)

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
      console.log(new URL(`/${f}?format=pdf`, electronBaseURL).href)
      await PDFDocument
        .load(
          await fetch(new URL(`/${f}?format=pdf`, electronBaseURL).href)
            .then((r) => r.buffer())
        )
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
  electron.kill()
}

if (require.main === module) {
  main().catch(console.error)
}
