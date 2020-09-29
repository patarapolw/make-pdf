import { Parser } from 'htmlparser2'
import { elementClose, elementOpen, patch, text } from 'incremental-dom'

import { hash } from '../util'

export const incremental = {
  patch (dom: HTMLElement, s: string): Node {
    return patch(dom, this.make(s))
  },
  make (s: string): () => void {
    const open = (name: string, attr: Record<string, string> = {}) => {
      elementOpen(
        name,
        name + '-' + hash(JSON.stringify(attr)),
        Object.entries(attr).flat()
      )
    }

    const close = (name: string) => {
      elementClose(name)
    }

    const iDOMParser = new Parser(
      {
        onopentag: open,
        ontext: text,
        onclosetag: close
      },
      {
        decodeEntities: true,
        lowerCaseAttributeNames: false,
        lowerCaseTags: false,
        recognizeSelfClosing: true
      }
    )

    return () => {
      iDOMParser.write(s)
    }
  }
}
