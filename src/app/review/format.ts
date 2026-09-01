const number = new Intl.NumberFormat('id-ID')
const dateTime = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
})

export const formatNumber = (value: number) => number.format(value)
export const formatRupiah = (value: number) => `Rp${number.format(value)}`
export const formatDateTime = (value: Date) => dateTime.format(value)
