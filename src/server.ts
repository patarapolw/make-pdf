import fs from 'fs'
import path from 'path'

import { Router } from 'express'
import yaml from 'js-yaml'

import { userRoot } from './config'
import { MakeHtml } from './make-html'
import { matter } from './make-html/matter'

export const router = Router()

router.get('/config', (req, res) => {
  let filepath: string
  filepath = path.resolve(userRoot, 'config.json')
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath)
    return
  }

  filepath = path.resolve(userRoot, 'config.yaml')
  if (fs.existsSync(filepath)) {
    res.json(
      yaml.safeLoad(fs.readFileSync(filepath, 'utf-8'), {
        schema: yaml.JSON_SCHEMA
      })
    )
    return
  }

  res.json({})
})

router.get('/*', async (req, res, next) => {
  try {
    const isMeta = typeof req.query.meta !== 'undefined'
    let filepath = path.resolve(userRoot, req.path.substr(1))
    if (fs.existsSync(filepath)) {
      res.sendFile(filepath)
      return
    }

    const fmt = (/\.([A-Za-z0-9]+)$/.exec(req.path) || [])[0]

    if (fmt === '.html') {
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
