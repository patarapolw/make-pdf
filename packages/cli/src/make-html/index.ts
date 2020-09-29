import fs from 'fs'
import path from 'path'

import imsize from '@patarapolw/markdown-it-imsize'
import domino from 'domino'
import MarkdownIt from 'markdown-it'
import emoji from 'markdown-it-emoji'
import externalLinks from 'markdown-it-external-links'
import { unescapeAll } from 'markdown-it/lib/common/utils'
import fetch from 'node-fetch'
import pug from 'pug'
import sass from 'sass'

import { hash } from '../util'
import { matter } from './matter'

export class Highlighter {
  static getInstance (): Highlighter {
    Highlighter.self = Highlighter.self || new Highlighter()
    return Highlighter.self
  }

  private static self: Highlighter | null

  alias: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    md: 'markdown',
    html: 'xml',
    pug: 'jade'
  }

  prism: {
    get(lang: string): string | null
    scripts: string[]
    styles: string[]
  }

  private constructor () {
    const ver = '1.21.0'
    this.prism = {
      ...this.getLang(
        'prism',
        ver,
        /^components\/prism-(?<lang>\S+)\.min\.js$/
      ),
      scripts: [`https://cdnjs.cloudflare.com/ajax/libs/prism/${ver}/prism.min.js`],
      styles: [`https://cdnjs.cloudflare.com/ajax/libs/prism/${ver}/themes/prism.min.css`]
    }
  }

  private getLang (
    lib: string,
    ver: string,
    parser: RegExp,
    prev = new Set<string>()
  ) {
    const lang: Record<string, string> = {}
    fetch(`https://api.cdnjs.com/libraries/${lib}/${ver}?fields=files`)
      .then((r) => r.json())
      .then((data: { files: string[] }) => {
        data.files
          .map((f) => {
            const m = parser.exec(f)
            if (m?.groups?.lang) {
              lang[m.groups.lang] =
                `https://cdnjs.cloudflare.com/ajax/libs/${lib}/${ver}/${f}`
            }
          })
      })

    return {
      get: (ln: string): string | null => {
        if (prev.has(ln)) return null

        const url = lang[ln]
        if (url) return url
        if (!this.alias[ln]) return null
        if (prev.has(this.alias[ln])) return null

        return lang[this.alias[ln]] || null
      }
    }
  }
}

export class MakeHtml {
  private id: string
  private hl = Highlighter.getInstance()

  private md: MarkdownIt

  private deps: string[] = []

  constructor (id?: string) {
    this.id = 'el-' + (id ? hash(id) : Math.random().toString(36))
    this.md = MarkdownIt({
      breaks: true,
      html: true
    })
      .use((md) => {
        const { fence } = md.renderer.rules

        md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
          const token = tokens[idx]
          const info = token.info ? unescapeAll(token.info).trim() : ''
          const content = token.content

          if (info === 'pug parsed') {
            return this._pugConvert(content)
          }

          const url = this.hl.prism.get(info)
          if (url) {
            this.deps.push(url)
          }

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return fence!(tokens, idx, options, env, slf)
        }
        return md
      })
      .use(emoji)
      .use(imsize)
      .use(externalLinks, {
        externalTarget: '_blank',
        externalRel: 'noopener nofollow noreferrer'
      })
  }

  render (s: string): string {
    try {
      const doc = domino.createDocument(/* html */`<body>
        <div class="${this.id}"></div>
      </body>`, true)

      const dom = doc.querySelector(`.${this.id}`) as HTMLDivElement

      this.hl.prism.scripts.map((src) => {
        const script = doc.createElement('script')
        script.src = src
        doc.body.appendChild(script)
      })
      this.hl.prism.styles.map((href) => {
        const link = doc.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        doc.head.appendChild(link)
      })

      dom.innerHTML = this._mdConvert(matter.split(s).content)
        .replace(/<!-- pdf-([A-Za-z-]+) -->/g, '<div class="pdf-$1"></div>')

      this.deps.map((url) => {
        if (/\.css($|\?)/.test(url)) {
          const link = doc.createElement('link')
          link.rel = 'stylesheet'
          link.href = url
          doc.head.appendChild(link)
        } else {
          const script = doc.createElement('script')
          script.src = url
          doc.body.appendChild(script)
        }
      })

      Array.from(doc.querySelectorAll('style')).map((el) => {
        const scss = el.innerHTML || ''
        if (scss.trim()) {
          el.innerHTML = sass.renderSync({
            data: `.${this.id} {${scss}}`
          }).css.toString('utf-8')
        }
      })

      const dStyle = doc.createElement('style')
      dStyle.innerHTML = fs.readFileSync(
        path.resolve(__dirname, '../../assets/defaults.css'), 'utf-8')
      doc.head.appendChild(dStyle)

      const dScript = doc.createElement('script')
      dScript.innerHTML = fs.readFileSync(
        path.resolve(__dirname, '../../assets/defaults.js'), 'utf-8')
      doc.body.appendChild(dScript)

      return doc.documentElement.outerHTML
    } catch (e) {
      console.error(e)
    }

    return ''
  }

  private _pugConvert (s: string) {
    return pug.compile(s, {
      filters: {
        markdown: (s: string) => this._mdConvert(s)
      }
    })()
  }

  private _mdConvert (s: string) {
    return this.md.render(s)
  }
}
