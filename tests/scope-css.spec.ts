import { scopeCss } from '@/make-html/css'

console.log(scopeCss(/* scss */`
:global {
  body {
    position: fixed;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

html {
  all: unset;
}
`, '.scope'))
