# Creating PDF's from markdown

With features that markdown normally won't have.

## Page breaks

Try `<!-- pdf-break -->`.

## Centering

Simply wrap in `<div class="pdf-center"></div>`.

If you want to render markdown inside it, leave a blank line just after-div-open and before-div-end. (Markdown-it did this way. Maybe it is based on CommonMark?)

## HTML, Markdown, PDF, and other assets' merging

This is possible because of <https://github.com/Hopding/pdf-lib>.

![pdf-lib logo](https://raw.githubusercontent.com/Hopding/pdf-lib-docs/master/assets/logo-full.svg?sanitize=true)

So, all Node.js dependencies. No [PDFtk](https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/) (binary) or [pdfbox](https://pdfbox.apache.org/) (Java) for now.

One of the three is required to merge PDF files.

## Printing options

Margin can also be set to `null` to disable margins.

For more options, see <https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#pagepdfoptions>.

## CLI

So, I made `@patarapolw/make-pdf` as a CLI. All dependencies are Node.js's.

```sh
npm install -g @patarapolw/make-pdf
```

```
$ makepdf --help
makepdf <...files> [...opts]

Create PDF from markdown, or HTML files

Options:
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
  -o, --output   Output PDF filename                                    [string]
  -p, --port     Choose a port to preview PDF                   [default: 28515]
  -r, --root     Root to run server from                                [string]
  -c, --config   Path to config file, or config in JSON form            [string]
      --preview  Preview in browser                                    [boolean]
```
