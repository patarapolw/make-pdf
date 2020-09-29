import fs from 'fs'
import path from 'path'

import { Router } from 'express'

import { userIn } from './config'
import { MakeHtml } from './make-html'
import { matter } from './make-html/matter'

export const router = Router()

router.get('/*', async (req, res, next) => {
  try {
    const format = req.query.format as string
    const filepath = path.resolve(userIn, req.path.substr(1))

    if (!fs.existsSync(filepath)) {
      next()
      return
    }

    if (format === 'meta') {
      res.json(matter.parse(
        fs.readFileSync(filepath, 'utf-8')
      ).data)
      return
    } else if (format === 'html') {
      const makeHtml = new MakeHtml(filepath)
      res.contentType('html')
      res.send(await makeHtml.parse(
        fs.readFileSync(filepath, 'utf-8')
      ))
      return
    }

    res.sendFile(filepath)
  } catch (e) {
    next(e)
  }
})

router.get('/favicon.ico', (_, res) => res.send(''))
