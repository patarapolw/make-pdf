#! /usr/bin/env node

import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

import yargs from 'yargs'
import ejs from 'ejs'

import { matter } from './matter'
import pkg from '../package.json'

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
      alias: 'l',
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

  const parseInclude = (
    filename: string
  ): {
    data: {
      showdown?: showdown.ShowdownOptions
      [k: string]: unknown
    }
    content: string
  } => {
    if (!/\.(md|markdown)$/.test(filename)) {
      return {
        data: {},
        content: fs.readFileSync(filename, 'utf-8')
      }
    }

    const s = fs.readFileSync(filename, 'utf-8')
    const { data, content } = matter.parse(s)
    return {
      data,
      content
    }
  }

  const top = parseInclude(argv.infile)

  const parsedMarkdown = await ejs.render(top.content, {
    ...top.data,
    include: (s: string): string => {
      return parseInclude(s).content
    }
  }, { async: true })

  await new Promise((resolve, reject) => {
    exec(
      `echo ${cmdQuote(parsedMarkdown)} | pandoc -t ${cmdQuote(
        argv.latex
      )} -o ${cmdQuote(
        path.relative(path.dirname(argv.infile), argv.outfile as string)
      )}`,
      {
        cwd: path.dirname(argv.infile)
      },
      (err, stdout) => {
        err ? reject(err) : resolve(stdout)
      }
    )
  })
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
