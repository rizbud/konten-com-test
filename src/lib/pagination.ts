/** A page number to link, or a gap standing in for pages that were left out. */
export type PageItem = number | 'gap'

/** Page numbers rendered at once. Gaps are not numbers and do not count. */
export const MAX_PAGE_LINKS = 5

/**
 * At most five page numbers: always the first and the last, and three around the
 * current page — sliding to stay inside the ends, so the row keeps a fixed width
 * whether you are on page 1 or page 2 500.
 *
 *   page 2   of 2500 -> 1 2 3 4 … 2500
 *   page 4   of 2500 -> 1 … 3 4 5 … 2500
 *   page 2499 of 2500 -> 1 … 2497 2498 2499 2500
 *
 * A gap can therefore stand in for a single hidden page (page 5 of 6 shows
 * `1 2 3 4 … 6`). Spelling that page out instead would be friendlier but would
 * make the row six numbers wide, and the cap is the point.
 */
export function pageWindow(page: number, pageCount: number): PageItem[] {
  if (pageCount < 1) return []
  if (pageCount <= MAX_PAGE_LINKS) return numbersFrom(1, pageCount)

  const current = Math.min(Math.max(page, 1), pageCount)
  const middleStart =
    current <= 3
      ? 2
      : current >= pageCount - 2
        ? pageCount - 3
        : current - 1

  const numbers = [1, middleStart, middleStart + 1, middleStart + 2, pageCount]

  const items: PageItem[] = []
  let previous = 0
  for (const number of numbers) {
    if (previous > 0 && number - previous > 1) items.push('gap')
    items.push(number)
    previous = number
  }
  return items
}

function numbersFrom(start: number, end: number): PageItem[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}
