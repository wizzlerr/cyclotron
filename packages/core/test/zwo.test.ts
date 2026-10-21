import { describe, expect, it } from 'vitest'
import { parseZwo, ZwoError } from '../src'

const ZWO = `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Someone</author>
    <name>Over-Unders &amp; More</name>
    <description>Two sets.
Hard ones.</description>
    <sportType>bike</sportType>
    <category>Threshold</category>
    <tags><tag name="FTP"/></tags>
    <workout>
        <Warmup Duration="600" PowerLow="0.40" PowerHigh="0.75"/>
        <!-- <SteadyState Duration="999" Power="9"/> -->
        <SteadyState Duration="300" Power="0.88" Cadence="95">
            <textevent timeoffset="10" message="Settle in"/>
        </SteadyState>
        <IntervalsT Repeat="3" OnDuration="120" OffDuration="60" OnPower="1.05" OffPower="0.55" Cadence="100" CadenceResting="85"/>
        <Ramp Duration="60" PowerLow="0.6" PowerHigh="0.9"/>
        <FreeRide Duration="300" FlatRoad="1"/>
        <MaxEffort Duration="20"/>
        <UnknownThing Duration="50"/>
        <Cooldown Duration="300" PowerLow="0.40" PowerHigh="0.65"/>
    </workout>
</workout_file>`

describe('parseZwo', () => {
  it('maps .zwo elements onto workout steps', () => {
    const w = parseZwo(ZWO, 'zwo.1')
    expect(w).toMatchObject({
      id: 'zwo.1',
      name: 'Over-Unders & More',
      description: 'Two sets.\nHard ones.',
      type: 'threshold',
      source: 'zwo',
    })
    expect(w.steps).toEqual([
      { kind: 'ramp', durationS: 600, fromPct: 0.4, toPct: 0.75, cadence: undefined },
      { kind: 'steady', durationS: 300, pct: 0.88, cadence: 95 },
      {
        kind: 'repeat',
        count: 3,
        steps: [
          { kind: 'steady', durationS: 120, pct: 1.05, cadence: 100 },
          { kind: 'steady', durationS: 60, pct: 0.55, cadence: 85 },
        ],
      },
      { kind: 'ramp', durationS: 60, fromPct: 0.6, toPct: 0.9, cadence: undefined },
      { kind: 'freeride', durationS: 300 },
      { kind: 'maxeffort', durationS: 20 },
      // Cooldown always goes down.
      { kind: 'ramp', durationS: 300, fromPct: 0.65, toPct: 0.4, cadence: undefined },
    ])
  })

  it('rejects non-workouts and other sports', () => {
    expect(() => parseZwo('<html></html>', 'x')).toThrow(ZwoError)
    expect(() =>
      parseZwo(
        '<workout_file><sportType>run</sportType><workout><SteadyState Duration="60" Power="1"/></workout></workout_file>',
        'x',
      ),
    ).toThrow(/run/)
    expect(() => parseZwo('<workout_file><workout></workout></workout_file>', 'x')).toThrow(
      /no steps/,
    )
  })
})
