import { describe, expect, it } from 'vitest'

import { MAX_PAGE_LINKS, pageWindow } from './pagination'

const numbers = (items: ReturnType<typeof pageWindow>) =>
  items.filter((item): item is number => item !== 'gap')

describe('pageWindow', () => {
  it('lists every page when they all fit', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4])
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('matches the three shapes the pager is specified by', () => {
    expect(pageWindow(2, 2500)).toEqual([1, 2, 3, 4, 'gap', 2500])
    expect(pageWindow(4, 2500)).toEqual([1, 'gap', 3, 4, 5, 'gap', 2500])
    expect(pageWindow(2499, 2500)).toEqual([1, 'gap', 2497, 2498, 2499, 2500])
  })

  it('never renders more than five page numbers', () => {
    for (const pageCount of [6, 7, 12, 99, 2500]) {
      for (let page = 1; page <= pageCount; page++) {
        expect(numbers(pageWindow(page, pageCount)).length).toBeLessThanOrEqual(
          MAX_PAGE_LINKS,
        )
      }
    }
  })

  it('always offers the first and last page', () => {
    for (const pageCount of [6, 40, 2500]) {
      for (const page of [1, 2, 3, 4, pageCount - 1, pageCount]) {
        const shown = numbers(pageWindow(page, pageCount))
        expect(shown[0]).toBe(1)
        expect(shown[shown.length - 1]).toBe(pageCount)
      }
    }
  })

  it('always offers the current page as one of the numbers', () => {
    for (const pageCount of [6, 7, 40, 2500]) {
      for (let page = 1; page <= pageCount; page++) {
        expect(numbers(pageWindow(page, pageCount))).toContain(page)
      }
    }
  })

  it('stays sorted and never repeats a page', () => {
    for (let pageCount = 1; pageCount <= 30; pageCount++) {
      for (let page = 1; page <= pageCount; page++) {
        const shown = numbers(pageWindow(page, pageCount))
        expect(new Set(shown).size).toBe(shown.length)
        expect([...shown].sort((a, b) => a - b)).toEqual(shown)
      }
    }
  })

  it('clamps a page number that is past the end', () => {
    expect(pageWindow(9999, 2500)).toEqual([1, 'gap', 2497, 2498, 2499, 2500])
    expect(pageWindow(0, 2500)).toEqual([1, 2, 3, 4, 'gap', 2500])
  })

  it('is empty when there is nothing to page through', () => {
    expect(pageWindow(1, 0)).toEqual([])
  })
})
