import { URL } from 'url'

import { makeFileServer } from '@patarapolw/make-pdf'
import express from 'express'

import { makeParcel } from './config'

async function main () {
  const fileServer = await makeFileServer(0, {
    cwd: '../../example'
  })

  const app = express()

  app.get('/file/*', (req, res) => {
    const addr = fileServer.server.address()
    const url = new URL(`/${req.url.replace(/^\/file\//, '')}`,
      typeof addr === 'string'
        ? addr
        : `http://localhost:${addr ? addr.port : null}`)

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
}

if (require.main === module) {
  main().catch(console.error)
}
