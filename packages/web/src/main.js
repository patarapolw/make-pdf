// @ts-check
import CodeMirror from 'codemirror'
import { jsPDF as PDF } from 'jspdf'
import { cmOptions } from './plugins/codemirror'
import html2canvas from 'html2canvas'

(function() {
  this.html2canvas = html2canvas
}).apply(window);

async function main () {
  const cm = CodeMirror.fromTextArea(
    document.querySelector('textarea'),
    cmOptions
  )
  cm.setOption('mode', 'xml')

  cm.addKeyMap({
    'Cmd-S': () => {
      reload()
    },
    'Ctrl-S': () => {
      reload()
    }
  })

  cm.setSize('100%', '100%')

  async function reload() {
    const renderer = /** @type {HTMLDivElement} */ (
      document.querySelector('[data-pdf-section]')
    )
    renderer.innerHTML = cm.getValue()

    const pdf = new PDF({
      format: 'A5'
    })
    await pdf.html(renderer, {
      html2canvas: {
        width: 500,
      }
    })

    const iframe = /** @type {HTMLIFrameElement} */ (
      document.querySelector('.viewer > iframe')
    )
    iframe.src = pdf.output('datauristring')
  }
  reload()
}

main().catch(console.error)
