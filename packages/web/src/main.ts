import './main.scss'

import CodeMirror from 'codemirror'

import { makeImg, parseHighlight } from './md-to-img'
import { cmOptions } from './plugins/codemirror'

window.CodeMirror = CodeMirror

async function main () {
  const cm = CodeMirror.fromTextArea(
    document.querySelector('textarea') as HTMLTextAreaElement,
    cmOptions
  )

  cm.addKeyMap({
    'Cmd-S': () => {
      reload()
    },
    'Ctrl-S': () => {
      reload()
    }
  })

  cm.setSize('100%', '100%')
  cm.on('change', () => {
    parseHighlight(
      cm.getValue(),
      document.querySelector('[data-output]') as HTMLDivElement
    )
  })

  async function reload () {
    const img = document.querySelector('.viewer > img') as HTMLImageElement
    img.src = await makeImg(
      cm.getValue(),
      document.querySelector('[data-output]') as HTMLDivElement,
      {
        width: '45vw'
      }
    )
  }
}

main().catch(console.error)
