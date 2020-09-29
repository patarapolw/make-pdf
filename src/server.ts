import fs from 'fs'
import path from 'path'

import { Router } from 'express'

import { userRoot } from './config'
import { MakeHtml } from './make-html'
import { matter } from './make-html/matter'

export const router = Router()

router.get('/*', async (req, res, next) => {
  try {
    const isMeta = typeof req.query.meta !== 'undefined'
    let filepath = path.resolve(userRoot, req.path.substr(1))
    const isHtml = filepath.endsWith('.html')

    if (filepath.endsWith('.html')) {
      filepath = filepath.replace(/\.html$/, '.md')
    }

    if (!fs.existsSync(filepath)) {
      next()
      return
    }

    if (isMeta) {
      res.json(matter.parse(
        fs.readFileSync(filepath, 'utf-8')
      ).data)
      return
    }

    if (!isHtml) {
      res.sendFile(filepath)
      return
    }

    const makeHtml = new MakeHtml(filepath)
    res.contentType('html')
    res.send(await makeHtml.parse(
      fs.readFileSync(filepath, 'utf-8')
    ))
  } catch (e) {
    next(e)
  }
})

router.get('/favicon.ico', (_, res) => res.send(''))
