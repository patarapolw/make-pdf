import { URL } from 'url'

import { makeFileServer } from '@make-pdf/cli'
import express from 'express'

import { makeParcel } from './config'

const app = express()

const fileServer = makeFileServer(0, {
  userIn: '../../in'
})

app.get('/file/*', (req, res) => {
  const addr = fileServer.address()
  const url = new URL(`/${req.url.replace(/^\/file\//, '')}`,
    typeof addr === 'string'
      ? addr
      : `http://localhost:${addr ? addr.port : null}`)
  console.log(url.href)
  res.redirect(url.href)
})

app.use(makeParcel().middleware())

const srv = app.listen(1234, () => {
  const addr = srv.address()
  console.info(`Dev server at ${
    typeof addr === 'string'
      ? addr
      : `http://localhost:${addr ? addr.port : null}`
  }`)
})
