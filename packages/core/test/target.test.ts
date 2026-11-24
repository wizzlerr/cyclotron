import { describe, expect, it } from 'vitest'
import { targetFit, tileTarget } from '../src/ride/target'

describe('targetFit', () => {
  it('rates power by percent of the target, at least a few watts', () => {
    expect(targetFit('power', 205, 200)).toBe('on')
    expect(targetFit('power', 188, 200)).toBe('near')
    expect(targetFit('power', 170, 200)).toBe('off')
    // Low targets: 5 W / 10 W bands.
    expect(targetFit('power', 64, 60)).toBe('on')
    expect(targetFit('power', 69, 60)).toBe('near')
    expect(targetFit('power', 71, 60)).toBe('off')
  })

  it('rates cadence in rpm', () => {
    expect(targetFit('cadence', 95, 90)).toBe('on')
    expect(targetFit('cadence', 81, 90)).toBe('near')
    expect(targetFit('cadence', 102, 90)).toBe('off')
  })

  it('has nothing to say without a target or a reading', () => {
    expect(targetFit('cadence', 90, undefined)).toBeUndefined()
    expect(targetFit('cadence', undefined, 90)).toBeUndefined()
    expect(targetFit('power', 100, 0)).toBeUndefined()
    expect(targetFit('power', NaN, 200)).toBeUndefined()
  })
})

describe('tileTarget', () => {
  it('picks the first power or cadence number of a tile', () => {
    expect(tileTarget(['power3s', 'target'])).toEqual({
      kind: 'power',
      actual: 'power3s',
      target: 'target',
    })
    expect(tileTarget(['target', 'power10s'])?.actual).toBe('power10s')
    expect(tileTarget(['target'])?.actual).toBe('power3s')
    expect(tileTarget(['hr', 'cadenceTarget', 'power3s'])).toEqual({
      kind: 'cadence',
      actual: 'cadence',
      target: 'cadenceTarget',
    })
    expect(tileTarget(['hr', 'elapsed'])).toBeUndefined()
  })
})
