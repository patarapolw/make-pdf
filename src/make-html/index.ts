/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-empty-function */
import imsize from '@patarapolw/markdown-it-imsize'
import HyperPug from 'hyperpug'
import { patch } from 'incremental-dom'
import MarkdownIt from 'markdown-it'
import mdContainer from 'markdown-it-container'
import emoji from 'markdown-it-emoji'
import externalLinks from 'markdown-it-external-links'
import { unescapeAll } from 'markdown-it/lib/common/utils'

import { hash } from '../util'
import { scopeCss } from './css'
import { incremental } from './incremental'
import { matter } from './matter'

let doFetch: Window['fetch']

if (typeof window !== 'undefined') {
  doFetch = window.fetch
} else {
  doFetch = require('node-fetch')
}

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

  codemirror?: {
    get(lang: string): string | null
  }

  private constructor () {
    let ver: string
    ver = '1.21.0'
    this.prism = {
      ...this.getLang(
        'prism',
        ver,
        /^components\/prism-(?<lang>\S+)\.min\.js$/
      ),
      scripts: [`https://cdnjs.cloudflare.com/ajax/libs/prism/${ver}/prism.min.js`],
      styles: [`https://cdnjs.cloudflare.com/ajax/libs/prism/${ver}/themes/prism.min.css`]
    }

    if (typeof window !== 'undefined') {
      ver = '5.58.1'
      this.codemirror = {
        ...this.getLang(
          'codemirror',
          ver,
          /^mode\/(?<lang>\S+)\/.+\.min\.js$/,
          new Set(['yaml', 'markdown', 'pug', 'html', 'xml', 'css'])
        )
      }
    }
  }

  private getLang (
    lib: string,
    ver: string,
    parser: RegExp,
    prev = new Set<string>()
  ) {
    const lang: Record<string, string> = {}
    doFetch(`https://api.cdnjs.com/libraries/${lib}/${ver}?fields=files`)
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
  private w: {
    document: Document
    CodeMirror?: typeof import('codemirror')
    Prism?: typeof import('prismjs')
  } = typeof window !== 'undefined'
    ? window
    : new (require('jsdom') as typeof import('jsdom')).JSDOM().window

  private md: MarkdownIt
  private hp: HyperPug

  onCmChanged = (): void => {}
  onPrismChanged = (): void => {}

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

          let url: string | null
          url = this.hl.prism.get(info)
          if (url && !this.w.document.querySelector(`script[src="${url}"]`)) {
            const script = this.w.document.createElement('script')
            script.src = url
            script.setAttribute('data-highlight', 'prism')
            script.onload = () => {
              this.onPrismChanged()
              script.onload = null
            }

            this.w.document.body.appendChild(script)
          }

          url = this.hl.codemirror ? this.hl.codemirror.get(info) : null
          if (url && !this.w.document.querySelector(`script[src="${url}"]`)) {
            const script = this.w.document.createElement('script')
            script.src = url
            script.setAttribute('data-highlight', 'codemirror')
            script.onload = () => {
              this.onCmChanged()
              script.onload = null
            }

            this.w.document.body.appendChild(script)
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
      .use(mdContainer, 'spoiler', {
        validate: (params: string) => {
          return params.trim().match(/^spoiler(?:\s+(.*))?$/)
        },
        render: (tokens: {
          info: string;
          nesting: number;
        }[], idx: number) => {
          const m = tokens[idx].info.trim().match(/^spoiler(?:\s+(.*))?$/)

          if (m && tokens[idx].nesting === 1) {
            // opening tag
            return (
              '<details><summary>' +
              this.md.utils.escapeHtml(m[1] || 'Spoiler') +
              '</summary>\n'
            )
          } else {
            // closing tag
            return '</details>\n'
          }
        }
      })

    this.hp = new HyperPug({
      markdown: (s: string) => this._mdConvert(s)
    })
  }

  async parse (s: string): Promise<string> {
    return (await this.render(
      s,
      this.w.document.createElement('div')
    )).innerHTML
  }

  async render (s: string, dom: HTMLElement): Promise<Element> {
    try {
      let scriptTarget: HTMLElement | null = null

      if (typeof window === 'undefined') {
        scriptTarget = dom
      } else if (!this.w.Prism && !this.w.document.querySelector('[data-highlight]')) {
        scriptTarget = this.w.document.body
      }

      if (scriptTarget) {
        const target = scriptTarget

        this.hl.prism.scripts.map((src) => {
          const script = this.w.document.createElement('script')
          script.src = src
          script.setAttribute('data-highlight', 'prism')
          target.append(script)
        })
        this.hl.prism.styles.map((href) => {
          const link = this.w.document.createElement('link')
          link.rel = 'stylesheet'
          link.href = href
          link.setAttribute('data-highlight', 'prism')
          target.prepend(link)
        })
      }

      let body = dom.querySelector(`.${this.id}`)

      if (!body) {
        body = this.w.document.createElement('div')
        body.className = `.${this.id}`
        dom.append(body)
        body.innerHTML = this._mdConvert(matter.split(s).content)
      } else {
        patch(body, incremental.make(
          this._mdConvert(matter.split(s).content)
        ))
      }

      body.querySelectorAll('style').forEach((el) => {
        el.innerHTML = scopeCss(el.innerHTML, `.${this.id}`)
      })

      body.querySelectorAll('img, iframe').forEach((el) => {
        el.setAttribute('loading', 'lazy')
      })

      if (this.w.Prism) {
        this.w.Prism.highlightAllUnder(body)
      }
    } catch (_) {}

    return dom
  }

  private _pugConvert (s: string) {
    return this.hp.parse(s)
  }

  private _mdConvert (s: string) {
    return this.md.render(s)
  }
}
