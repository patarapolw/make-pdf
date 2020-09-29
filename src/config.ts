import path from 'path'

import S, { ObjectSchema } from 'jsonschema-definer'
import { PDFOptions } from 'puppeteer'

export const userIn = path.resolve(process.cwd(), process.env.IN || './in')
export const userOut = path.resolve(process.cwd(), process.env.OUT || './out')

export const sConfig = S.shape({
  metadata: S.shape({
    title: S.string().optional(),
    author: S.string().optional(),
    subject: S.string().optional(),
    keywords: S.list(S.string()).optional(),
    producer: S.string().optional(),
    creator: S.string().optional(),
    creationDate: S.string().optional(),
    modificationDate: S.string().optional()
  }).optional(),
  printingOptions: S.object()
    .additionalProperties(true)
    .optional() as ObjectSchema<PDFOptions, false>
})
