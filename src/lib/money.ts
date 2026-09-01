/** Platform's cut of a gross earning, in percent. */
export const PLATFORM_FEE_PERCENT = 20

export type Earning = {
  /** What the submission is worth at approval, before the platform's cut. */
  gross: number
  /** ClipPay's cut. Derived from gross and net so the three always reconcile. */
  fee: number
  /** What the creator ends up with. */
  net: number
}

/**
 * Rupiah are whole numbers, so this is integer arithmetic with exactly one
 * floor per value. `views` and `cpm` are both integers, so `views * cpm` is
 * exact and the division is the only place precision is lost.
 *
 * `net` is floor(gross * 80 / 100) — not gross - floor(gross * 20 / 100),
 * which rounds the other way and disagrees with the brief's reference case.
 * `fee` is the remainder, never rounded on its own, so gross === net + fee
 * always holds.
 */
export function calculateEarning(views: number, cpm: number): Earning {
  if (!Number.isInteger(views) || views < 0) {
    throw new Error(`views must be a non-negative integer, got ${views}`)
  }
  if (!Number.isInteger(cpm) || cpm <= 0) {
    throw new Error(`cpm must be a positive integer, got ${cpm}`)
  }

  const gross = Math.floor((views * cpm) / 1000)
  const net = Math.floor((gross * (100 - PLATFORM_FEE_PERCENT)) / 100)

  return { gross, fee: gross - net, net }
}
