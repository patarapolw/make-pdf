export function naturalSort (a: string, b: string): number {
  return _naturalSortParser(a).localeCompare(_naturalSortParser(b))
}

const _largePositive = Math.pow(Number.MAX_SAFE_INTEGER, 0.5)

function _naturalSortParser (x: string): string {
  const name = x.slice(0, -3)
  if (/^\d+(\.\d+)?$/.test(name)) {
    return (parseFloat(name) + _largePositive)
      .toString(36)
      .padStart(_largePositive.toString().length)
  }
  return name
}
