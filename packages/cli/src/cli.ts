#! /usr/bin/env node

import { spawnSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import ejs from 'ejs'
import puppeteer, { Browser } from 'puppeteer'
import yargs from 'yargs'

import pkg from '../package.json'
import { matter } from './matter'

async function main() {
  const { argv } = yargs
    .scriptName(Object.keys(pkg.bin)[0])
    .version(pkg.version)
    .command('$0 <infile> [outfile]', pkg.description, (y) => {
      y.positional('infile', {
        normalize: true
      }).positional('outfile', {
        normalize: true
      })
    })
    .option('infile', {
      type: 'string',
      demandOption: true
    })
    .option('outfile', {
      type: 'string'
    })
    .option('latex', {
      alias: 't',
      describe: 'Choose your latex dialect',
      type: 'string',
      choices: ['latex', 'context', 'html5'],
      default: 'latex'
    })
    .option('force', {
      alias: 'f',
      describe: 'Overwrite previous output files if exists',
      type: 'boolean',
      default: false
    })
    .check((argv) => {
      if (!fs.existsSync(argv.infile)) {
        throw new Error('Input file must exist')
      }

      if (argv.outfile && argv.force && fs.existsSync(argv.outfile)) {
        throw new Error('Cannot overwrite output file (try -f to overwrite)')
      }

      if (!argv.outfile) {
        let i = 1
        argv.outfile = argv.infile.replace(/\.(md|markdown)$/, '') + `.pdf`
        while (fs.existsSync(argv.outfile)) {
          argv.outfile =
            argv.infile.replace(/\.(md|markdown)$/, '') + `~${i}.pdf`
          i++
        }
      }

      return true
    })

  const ROOT = path.dirname(argv.infile)

  const top = matter.parse(fs.readFileSync(argv.infile, 'utf-8'))
  argv.latex = (top.data.latex as string) || argv.latex

  const pngHash = new Map<
    string,
    {
      data: string
      width?: number
    }
  >()

  const ejsRender = (md: string, d: Record<string, unknown>) =>
    ejs.compile(md)({
      ...d,
      include: (f: string) => {
        const { data, content } = matter.parse(
          fs.readFileSync(path.join(ROOT, f), 'utf-8')
        )
        return ejsRender(content, { ...d, ...data })
      },
      md2png: (md: string, opts: { width?: number; delay?: number } = {}) => {
        let h = crypto.randomBytes(8).toString('hex')
        while (pngHash.has(h)) {
          h = crypto.randomBytes(8).toString('hex')
        }

        pngHash.set(h, {
          data: md,
          width: opts.width
        })

        return new (class {
          constructor(public url: string) {}

          toString() {
            return `![](${this.url})`
          }
        })(h)
      }
    })

  let parsedMarkdown = ejsRender(top.content, top.data)

  const tmp = new Tmp(argv.infile)

  let browser: Browser | null = null
  if (pngHash.size) {
    browser = await puppeteer.launch()
  }

  if (browser) {
    for (const [h, content] of pngHash) {
      const page = await browser.newPage()
      await page.goto(
        `data:text/html;charset=UTF-8,<div class="el-${h}"></div>`
      )
      await page.evaluate(
        fs.readFileSync(
          path.resolve(__dirname, '../public/md-to-img.js'),
          'utf-8'
        )
      )

      const imgb64 = await page.evaluate(
        (content, h, opts) => {
          const { makeImg } = (window as unknown) as {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            makeImg(c: string, dom: any, opts: any): Promise<string>
          }
          return makeImg(content, document.querySelector(`.el-${h}`), opts)
        },
        content.data,
        h,
        {
          width: content.width || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          showdown: (top.data.showdown as any) || {}
        }
      )

      const tmpfile = tmp.create('.png')
      fs.writeFileSync(tmpfile, Buffer.from(imgb64.split(',')[1], 'base64'))

      parsedMarkdown = parsedMarkdown.replace(h, tmpfile)
      page.close()
    }
  }

  const tmpfile = tmp.create('.md')
  fs.writeFileSync(tmpfile, parsedMarkdown)

  spawnSync(
    'pandoc',
    [
      path.relative(ROOT, tmpfile),
      '-t',
      argv.latex,
      '-o',
      path.relative(ROOT, argv.outfile as string)
    ],
    {
      stdio: 'inherit',
      cwd: ROOT
    }
  )

  if (browser) {
    browser.close()
  }

  tmp.cleanup()
}

class Tmp {
  tmplist: string[] = []

  constructor(private infile: string) {}

  create(ext: string) {
    let tmpfile =
      this.infile.replace(/\.[A-Z]+$/i, '') +
      '~' +
      crypto.randomBytes(8).toString('hex') +
      ext

    while (fs.existsSync(tmpfile)) {
      tmpfile =
        this.infile.replace(/\.[A-Z]+$/i, '') +
        '~' +
        crypto.randomBytes(8).toString('hex') +
        ext
    }

    this.tmplist.push(tmpfile)

    return tmpfile
  }

  async cleanup() {
    return Promise.all(
      this.tmplist.map(
        async (f) =>
          new Promise((resolve, reject) => {
            fs.unlink(f, (err) => (err ? reject(err) : resolve()))
          })
      )
    )
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
