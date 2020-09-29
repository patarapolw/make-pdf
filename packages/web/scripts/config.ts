import path from 'path'

import Bundler, { ParcelOptions } from 'parcel-bundler'

export function makeParcel (type?: 'build'): Bundler {
  process.env.NODE_ENV = 'development'

  const opts: ParcelOptions = {}
  if (type === 'build') {
    opts.outDir = path.resolve(__dirname, '../../cli/public')
    process.env.NODE_ENV = 'production'
  }

  return new Bundler(
    path.resolve(__dirname, '../src/index.html'),
    opts
  )
}
