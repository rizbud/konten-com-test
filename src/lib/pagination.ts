/** A page number to link, or a gap standing in for pages that were left out. */
export type PageItem = number | 'gap'

/**
 * The numbers a pager should show: always the first and last page, always the
 * current page with `span` neighbours either side, and a gap marker wherever
 * that skips something. 2 500 pages of admin queue cannot all be links.
 */
export function pageWindow(page: number, pageCount: number, span = 1): PageItem[] {
  const wanted = new Set<number>()
  if (pageCount >= 1) {
    wanted.add(1)
    wanted.add(pageCount)
    for (let candidate = page - span; candidate <= page + span; candidate++) {
      if (candidate >= 1 && candidate <= pageCount) wanted.add(candidate)
    }
  }

  const items: PageItem[] = []
  let previous = 0
  for (const current of [...wanted].sort((a, b) => a - b)) {
    const skipped = current - previous - 1
    // A gap standing in for exactly one page is worse than the page itself.
    if (previous > 0 && skipped === 1) items.push(previous + 1)
    else if (previous > 0 && skipped > 1) items.push('gap')
    items.push(current)
    previous = current
  }
  return items
}
