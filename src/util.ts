/**
* Calculate a 32 bit FNV-1a hash
* Found here: https://gist.github.com/vaiorabbit/5657561
* Ref.: http://isthe.com/chongo/tech/comp/fnv/
*
* @param {string} str the input value
* @param {integer} [seed] optionally pass the hash of the previous chunk
* @returns {string}
*/
export function hash (str: string, seed?: number): string {
  /* jshint bitwise:false */
  let i
  let l
  let hval = seed === undefined ? 0x811c9dc5 : seed

  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i)
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24)
  }

  return (hval >>> 0).toString(36)
}

export function deepMerge<T, U> (dst: T, src: U): T {
  if (is<Record<string, unknown>>(dst, {}) && is<Record<string, unknown>>(src, {})) {
    return Object.keys({ ...src, ...dst }).reduce((prev, k) => ({
      ...prev,
      [k]: deepMerge(dst[k], src[k])
    }), {}) as T
  }

  if (is<unknown[]>(dst, []) && is<unknown[]>(src, [])) {
    return Array(Math.max(dst.length, src.length))
      .fill(null)
      .map((_, i) => deepMerge(dst[i], src[i])) as unknown as T
  }

  if (typeof src === 'undefined') {
    return dst
  }

  if (src === null) {
    return undefined as unknown as T
  }

  return src as unknown as T
}

function is<T extends Record<string, unknown> | Array<unknown>> (
  o: unknown,
  type: T
): o is T {
  return o != null && (o as {
    constructor: unknown;
  }).constructor === type.constructor
}
