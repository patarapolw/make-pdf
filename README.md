# Creating PDF's from markdown

With features that markdown normally won't have.

## Page breaks

Page breaks are possible via merging multiple PDF's.

### Hello `Hopding/pdf-lib`

This is all possible because of <https://github.com/Hopding/pdf-lib>.

![pdf-lib logo](https://raw.githubusercontent.com/Hopding/pdf-lib-docs/master/assets/logo-full.svg?sanitize=true)

So, all Node.js dependencies. No [PDFtk](https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/) (binary) or [pdfbox](https://pdfbox.apache.org/) (Java) for now.

One of the three is required to merge PDF files.

## Centering

Secret to centering anything is CSS. As I enable [scope-css](https://www.npmjs.com/package/scope-css) by default, you will need an extra selector.

```html
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
```

## Printing options

Margin can also be set to `null` to disable margins.

For more options, see <https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#pagepdfoptions>.
