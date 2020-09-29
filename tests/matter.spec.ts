import fs from 'fs'

import { matter } from '../src/make-html/matter'

console.log(
  matter.parse(
    fs.readFileSync('in/index.md', 'utf-8')
  )
)
