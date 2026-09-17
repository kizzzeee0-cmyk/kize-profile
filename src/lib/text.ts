import type { SiteText } from '../types'

export function makeTextGetter(items: SiteText[]) {
  const map = new Map(items.map(item => [item.text_key, item.value]))
  return (key: string, fallback: string) => map.get(key) || fallback
}
