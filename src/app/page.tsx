import { redirect } from 'next/navigation'

// The admin queue is the only thing this slice builds; there is no landing page
// to write, so / goes straight there rather than keeping the scaffold's.
export default function Home() {
  redirect('/review')
}
