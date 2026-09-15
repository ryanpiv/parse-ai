import { clearHistory, readHistory, recordHistory } from '../../lib/analysisHistory'

function entry(url: string, name1 = 'Smaktat') {
  return { url, kind: 'solo' as const, name1, spec1: 'Mage', boss: 'Some Boss' }
}

describe('analysisHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('records newest first', () => {
    recordHistory(entry('url-a'))
    recordHistory(entry('url-b'))
    expect(readHistory().map(e => e.url)).toEqual(['url-b', 'url-a'])
  })

  it('deduplicates by url, bumping the entry to the top', () => {
    recordHistory(entry('url-a'))
    recordHistory(entry('url-b'))
    recordHistory(entry('url-a'))
    const urls = readHistory().map(e => e.url)
    expect(urls).toEqual(['url-a', 'url-b'])
    expect(readHistory()).toHaveLength(2)
  })

  it('caps the list at 50 entries', () => {
    for (let i = 0; i < 60; i++) recordHistory(entry(`url-${i}`))
    const list = readHistory()
    expect(list).toHaveLength(50)
    expect(list[0].url).toBe('url-59')
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('parse-analyzer-history', '{not json')
    expect(readHistory()).toEqual([])
  })

  it('clears', () => {
    recordHistory(entry('url-a'))
    clearHistory()
    expect(readHistory()).toEqual([])
  })
})
