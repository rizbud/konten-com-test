/**
 * Locale and time zone are pinned so a server render and a client re-render
 * produce byte-identical strings — an unpinned time zone hydrates differently
 * on an admin sitting outside Jakarta.
 */
const number = new Intl.NumberFormat('id-ID')
const dateTime = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
})

export const formatNumber = (value: number) => number.format(value)
export const formatRupiah = (value: number) => `Rp${number.format(value)}`
export const formatDateTime = (value: Date) => dateTime.format(value)

/**
 * For the database's lowercase enum-ish values in labels. CSS `capitalize` does
 * the same for a text node, but `<option>` ignores text-transform in some
 * browsers, so the label has to arrive already capitalised.
 */
export const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)
