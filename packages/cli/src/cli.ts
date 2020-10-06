#! /usr/bin/env node

import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import hbs from 'handlebars'
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
      width?: string
      height?: string
    }
  >()

  hbs.registerHelper('include', function (this: typeof hbs.registerHelper, f) {
    const { data, content } = matter.parse(
      fs.readFileSync(path.join(ROOT, f), 'utf-8')
    )
    return hbs.compile(content)({
      ...top.data,
      ...data
    })
  })

  hbs.registerHelper('html', function (this: typeof hbs.registerHelper, opts) {
    let h = crypto.randomBytes(8).toString('hex')
    while (pngHash.has(h)) {
      h = crypto.randomBytes(8).toString('hex')
    }

    pngHash.set(h, {
      data: opts.fn(this),
      width: opts.hash.width,
      height: opts.hash.height
    })
    return `![](${h})`
  })

  let parsedMarkdown = hbs.compile(top.content)(top.data)

  let browser: Browser | null = null

  if (pngHash.size) {
    browser = await puppeteer.launch({
      headless: true
    })
  }

  if (browser) {
    for (const [h, content] of pngHash) {
      const page = await browser.newPage()
      await page.goto(`data:text/html;charset=UTF-8,
      <div class="el-${h}"></div>
      `)

      await page.evaluate(
        fs.readFileSync(
          path.resolve(__dirname, '../public/md-to-img.js'),
          'utf-8'
        )
      )

      parsedMarkdown = parsedMarkdown.replace(
        h,
        (await page.evaluate(
          (content, h, opts) => {
            const { makeImg } = (window as unknown) as {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              makeImg(c: string, dom: HTMLElement, opts: any): Promise<string>
            }
            return makeImg(
              content,
              document.querySelector(`div.el-${h}`) as HTMLElement,
              opts
            )
          },
          content.data,
          h,
          {
            width: content.width || '',
            height: content.height || '',
            showdown: (top.data.showdown as showdown.ShowdownOptions) || {}
          }
        )) as string
      )

      await page.close()
    }

    await browser.close()
  }

  let tmpfile =
    argv.infile.replace(/\.[A-Z]+$/i, '') +
    '~' +
    crypto.randomBytes(8).toString('hex') +
    '.md'

  while (fs.existsSync(tmpfile)) {
    tmpfile =
      argv.infile.replace(/\.[A-Z]+$/i, '') +
      '~' +
      crypto.randomBytes(8).toString('hex') +
      '.md'
  }
  fs.writeFileSync(tmpfile, parsedMarkdown)

  execSync(
    `pandoc ${cmdQuote(path.relative(ROOT, tmpfile))} -t ${cmdQuote(
      argv.latex
    )} -o ${cmdQuote(path.relative(ROOT, argv.outfile as string))}`,
    {
      cwd: ROOT
    }
  )

  fs.unlinkSync(tmpfile)
}

function cmdQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
