import { compile, serialize, stringify } from 'stylis'

export function scopeCss (css: string, scope: string): string {
  return serialize(compile(`${scope}{${css}}`), stringify)
    .replace(/(^|\n)[^{]+:global /g, '$1')
}
