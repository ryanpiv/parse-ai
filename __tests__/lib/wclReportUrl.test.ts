import { describe, it, expect } from '@jest/globals'
import { parseWclUrl, resolveReportFightQuery } from '../../lib/wclReportUrl'

describe('parseWclUrl', () => {
  it('parses compare URLs', () => {
    const u =
      'https://www.warcraftlogs.com/reports/compare/Ab1cdEf2/XYz9wVu8?fight=12%2C34&source=Foo%2CBar'
    const p = parseWclUrl(u)
    expect(p).toEqual({
      kind: 'compare',
      r1: 'Ab1cdEf2',
      r2: 'XYz9wVu8',
      f1id: 12,
      f2id: 34,
      src1: 'Foo',
      src2: 'Bar',
    })
  })

  it('parses single-report URLs with fight and source', () => {
    const p = parseWclUrl('https://www.warcraftlogs.com/reports/aBcDeFg1?fight=7&source=123')
    expect(p).toEqual({ kind: 'report', code: 'aBcDeFg1', fightQuery: '7', source: '123' })
  })

  it('parses fight=last and fight=first from WCL share URLs', () => {
    expect(parseWclUrl('https://www.warcraftlogs.com/reports/X?fight=last&type=damage-done')).toEqual({
      kind: 'report',
      code: 'X',
      fightQuery: 'last',
      source: '',
    })
    expect(parseWclUrl('/reports/Ab1?fight=first')).toEqual({
      kind: 'report',
      code: 'Ab1',
      fightQuery: 'first',
      source: '',
    })
  })

  it('parses relative single-report path', () => {
    const p = parseWclUrl('/reports/zzZZ1234?fight=1')
    expect(p).toEqual({ kind: 'report', code: 'zzZZ1234', fightQuery: '1', source: '' })
  })

  it('rejects single-report without fight', () => {
    expect(() => parseWclUrl('https://www.warcraftlogs.com/reports/abc123')).toThrow(/fight/)
  })
})

describe('resolveReportFightQuery', () => {
  const fights = [
    { id: 1, startTime: 0, endTime: 100 },
    { id: 2, startTime: 200, endTime: 500 },
    { id: 3, startTime: 600, endTime: 900 },
  ]

  it('resolves numeric id', () => {
    expect(resolveReportFightQuery(fights, '2')).toBe(2)
  })

  it('resolves last by latest endTime', () => {
    expect(resolveReportFightQuery(fights, 'last')).toBe(3)
    expect(resolveReportFightQuery(fights, 'LAST')).toBe(3)
  })

  it('resolves first by earliest startTime', () => {
    expect(resolveReportFightQuery(fights, 'first')).toBe(1)
  })
})
