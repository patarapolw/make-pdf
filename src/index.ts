import pdfMake from 'pdfmake/build/pdfmake'
import { TDocumentDefinitions } from 'pdfmake/interfaces'

async function main () {
  const [config = {}, pdf, { files }] = await Promise.all([
    fetch(`/api/config?v=${Math.random().toString(36).substr(2)}`)
      .then((r) => r.json()),
    fetch(`/api/pdf?v=${Math.random().toString(36).substr(2)}`)
      .then((r) => r.json()),
    fetch(`/api/files?v=${Math.random().toString(36).substr(2)}`)
      .then((r) => r.json())
  ])

  const fileSet = new Set<string>(files)
  const vfs: Record<string, string> = {}

  async function resolveURL<T> (o: T): Promise<unknown> {
    if (o && typeof o === 'object') {
      if (Array.isArray(o)) {
        return Promise.all(o.map((a) => resolveURL(a)))
      } else if ((o as { constructor: unknown }).constructor === Object) {
        return Promise.all(
          Object.entries(o).map(([k, v]) => resolveURL(v).then((v1) => [k, v1]))
        ).then((ps) => ps.reduce((prev, [k, v]) => ({
          ...prev,
          [k as string]: v
        }), {}))
      }
    }

    if (o && typeof o === 'string') {
      let url: URL | null = null
      if (fileSet.has((o as string).substr(1))) {
        url = new URL(o, location.origin)
      } else if (/^https?:\/\/[^ ]+$/.test(o)) {
        try {
          url = new URL(o)
        } catch (_) {}
      }

      if (url) {
        const p = o as string
        const u = new URL('/api/base64', location.origin)
        u.searchParams.set('url', url.href)

        return fetch(u.href).then((r) => r.text()).then((r) => {
          vfs[p] = r
          if (p[0] === '/') {
            vfs[p.substr(1)] = vfs[p]
          }

          return p
        })
      }
    }

    return o
  }

  const doc = await resolveURL(pdf) as TDocumentDefinitions
  console.log(vfs)

  pdfMake.createPdf(
    doc,
    config.table,
    config.fonts,
    vfs
  ).getDataUrl((url) => {
    const elIframe = document.querySelector('iframe') as HTMLIFrameElement
    elIframe.src = url
  })
}

main().catch(console.error)
