import { describe, expect, it } from 'vitest'
import { shortUuid, sigUuid, uuidName } from '../src'

describe('uuids', () => {
  it('names SIG and Wahoo UUIDs', () => {
    expect(shortUuid('00001826-0000-1000-8000-00805f9b34fb')).toBe(0x1826)
    expect(sigUuid(0x2ad9)).toBe('00002ad9-0000-1000-8000-00805f9b34fb')
    expect(uuidName('00002ad9-0000-1000-8000-00805f9b34fb')).toBe('Fitness Machine Control Point')
    expect(uuidName('a026e005-0a7d-4ab3-97fa-f1500f9feb8b')).toBe('Wahoo (proprietary)')
    expect(uuidName('12345678-1234-1234-1234-123456789abc')).toBeUndefined()
  })
})
