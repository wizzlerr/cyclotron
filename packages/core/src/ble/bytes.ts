/** Formats bytes as space-separated lowercase hex, e.g. `44 00 e8 03`. */
export function toHex(data: DataView | Uint8Array): string {
  const bytes =
    data instanceof Uint8Array
      ? data
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ')
}

/** Parses `toHex` output (or any whitespace-separated hex) back into bytes. */
export function fromHex(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/).filter(Boolean)
  return Uint8Array.from(parts, (p) => {
    const n = Number.parseInt(p, 16)
    if (!/^[0-9a-f]{1,2}$/i.test(p) || Number.isNaN(n))
      throw new RangeError(`invalid hex byte: ${p}`)
    return n
  })
}
