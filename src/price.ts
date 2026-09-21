import type { CakeConfig, Catalog } from '../shared/types'

export function calcPrice(cat: Catalog, cake: CakeConfig) {
  const priceOf = (id: string, list: { id: string; price?: number }[]) => list.find(x => x.id === id)?.price || 0
  const base = priceOf(cake.sizeId, cat.sizes)
  const addons =
    priceOf(cake.baseId, cat.bases) +
    priceOf(cake.creamId, cat.creams) +
    cake.fillingIds.reduce((s, id) => s + priceOf(id, cat.fillings), 0) +
    cake.fruitIds.reduce((s, id) => s + priceOf(id, cat.fruits), 0) +
    priceOf(cake.styleId, cat.styles) +
    priceOf(cake.candleId, cat.candles) +
    Math.max(0, cake.tablewareSets - 6) * 2
  const coldChain = cake.needColdChain ? cat.coldChainFee : 0
  return { base, addons, coldChain, total: base + addons + coldChain }
}

export function latestModifyFor(pickupDate: string, leadHours: number) {
  const pickup = new Date(`${pickupDate}T12:00:00`)
  const lead = new Date(pickup.getTime() - leadHours * 3600 * 1000)
  const dayBefore = new Date(pickup)
  dayBefore.setDate(dayBefore.getDate() - 1); dayBefore.setHours(18, 0, 0, 0)
  return (lead.getTime() < dayBefore.getTime() ? lead : dayBefore).toISOString()
}

export function sensitiveWords(cat: Catalog, text: string) {
  return cat.sensitiveWords.filter(w => w && text.includes(w))
}
