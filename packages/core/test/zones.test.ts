import { describe, expect, it } from 'vitest'
import { powerZone } from '../src'

describe('powerZone', () => {
  it.each([
    [0, 1],
    [137, 1], // 54.8 %
    [138, 2], // 55.2 %
    [187, 2], // 74.8 %
    [225, 3], // 90 %
    [250, 4], // 100 %
    [263, 5], // 105.2 %
    [300, 5], // 120 %
    [375, 6], // 150 %
    [1000, 7],
  ])('%i W at FTP 250 → Z%i', (watts, zone) => {
    expect(powerZone(watts, 250)).toBe(zone)
  })

  it('rejects a non-positive FTP', () => {
    expect(() => powerZone(200, 0)).toThrow(RangeError)
  })
})
