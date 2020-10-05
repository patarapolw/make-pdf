import 'prismjs/themes/prism.css'

import showdown from 'showdown'
import domToImage from 'dom-to-image-even-more'
import Prism from 'prismjs'

import { matter } from './matter'

declare global {
  interface Window {
    CodeMirror: typeof import('codemirror')
    Prism: typeof import('prismjs')
    makePng: typeof makePng
  }
}

window.Prism = Prism

function getLang (
  lib: string,
  ver: string,
  parser: RegExp,
  prev = new Set<string>()
) {
  const alias: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    md: 'markdown',
    html: 'xml',
    pug: 'jade'
  }

  const lang: Record<string, string> = {}
  fetch(`https://api.cdnjs.com/libraries/${lib}/${ver}?fields=files`)
    .then((r) => r.json())
    .then((data: {
      files: string[]
    }) => {
      data.files
        .map((f) => {
          const m = parser.exec(f)
          if (m && m.groups && m.groups.lang) {
            lang[m.groups.lang] =
              `https://cdnjs.cloudflare.com/ajax/libs/${lib}/${ver}/${f}`
          }
        })
    })

  return {
    get (ln: string) {
      if (prev.has(ln)) return null

      const url = lang[ln]
      if (url) return url
      if (!alias[ln]) return null
      if (prev.has(alias[ln])) return null

      return lang[alias[ln]] || null
    }
  }
}

const prismLang = getLang(
  'prism',
  '1.21.0',
  /^components\/prism-(?<lang>\S+)\.min\.js$/
)

const cmLang = getLang(
  'codemirror',
  '5.58.1',
  /^mode\/(?<lang>\S+)\/.+\.min\.js$/,
  new Set(['yaml', 'markdown', 'pug', 'html', 'xml', 'css'])
)

export async function parseHighlight (md: string, dom: HTMLDivElement): Promise<void> {
  const { data, content } = matter.parse(md)
  const mdConverter = new showdown.Converter(data)
  dom.innerHTML = mdConverter.makeHtml(content)

  dom.querySelectorAll('pre code').forEach((el) => {
    el.classList.forEach((c) => {
      const m = /^language-(.+)$/.exec(c)
      if (m) {
        let url: string | null

        url = prismLang.get(m[1])
        if (url && !document.querySelector(`script[src="${url}"]`)) {
          const script = document.createElement('script')
          script.src = url
          script.setAttribute('data-highlight', 'prism')
          document.body.appendChild(script)
        }

        url = cmLang.get(m[1])
        if (window.CodeMirror && url && !document.querySelector(`script[src="${url}"]`)) {
          const script = document.createElement('script')
          script.src = url
          script.setAttribute('data-highlight', 'codemirror')

          document.body.appendChild(script)
        }
      }
    })
  })

  return new Promise((resolve) => {
    setTimeout(() => {
      Prism.highlightAllUnder(dom)
      resolve()
    }, 100)
  })
}

export async function makePng (md: string, dom: HTMLDivElement, opts: {
  width?: string
  height?: string
} = {}): Promise<string> {
  dom.style.width = opts.width || dom.style.width
  dom.style.height = opts.height || dom.style.height

  await parseHighlight(md, dom)
  return domToImage.toPng(dom)
}

window.makePng = makePng
