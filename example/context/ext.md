## YWs

Secret to centering anything is CSS. As I enable [scope-css](https://www.npmjs.com/package/scope-css) by default, you will need an extra selector.

\externalfigure[<%- md2png(`
${'```'}html
<style>
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
</style>
${'```'}
`, { width: 800 }).url %>][width=\textwidth]
