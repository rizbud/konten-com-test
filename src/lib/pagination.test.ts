import { describe, expect, it } from 'vitest'

import { pageWindow } from './pagination'

describe('pageWindow', () => {
  it('lists every page when they all fit', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4])
  })

  it('gaps the middle when the current page is at an edge', () => {
    expect(pageWindow(1, 2109)).toEqual([1, 2, 'gap', 2109])
    expect(pageWindow(2109, 2109)).toEqual([1, 'gap', 2108, 2109])
  })

  it('gaps both sides around a page in the middle', () => {
    expect(pageWindow(50, 100)).toEqual([1, 'gap', 49, 50, 51, 'gap', 100])
  })

  it('does not emit a gap that hides a single page', () => {
    // 1 … 3 4 5 … 7 would be wrong: the gaps stand for page 2 and page 6 alone.
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('never repeats a page', () => {
    for (let pageCount = 1; pageCount <= 12; pageCount++) {
      for (let page = 1; page <= pageCount; page++) {
        const numbers = pageWindow(page, pageCount).filter((item) => item !== 'gap')
        expect(new Set(numbers).size).toBe(numbers.length)
        expect([...numbers].sort((a, b) => a - b)).toEqual(numbers)
      }
    }
  })

  it('is empty when there is nothing to page through', () => {
    expect(pageWindow(1, 0)).toEqual([])
  })
})
