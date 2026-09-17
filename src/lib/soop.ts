export function normalizeSoopId(id: string) {
  return id.trim()
}

export function soopProfileCandidates(id: string) {
  const clean = normalizeSoopId(id)
  if (!clean) return []
  const bucket = clean.slice(0, 2).toLowerCase()
  return [
    `https://stimg.sooplive.com/LOGO/${bucket}/${clean}/m/${clean}.webp`,
    `https://profile.img.sooplive.com/LOGO/${bucket}/${clean}/m/${clean}.jpg`,
    `https://profile.img.sooplive.com/LOGO/${bucket}/${clean}/${clean}.jpg`,
  ]
}

export function primarySoopProfileUrl(id: string) {
  return soopProfileCandidates(id)[0] || ''
}

export function advanceSoopProfileImage(img: HTMLImageElement, id: string) {
  const candidates = soopProfileCandidates(id)
  const index = Number(img.dataset.profileIndex || 0)
  const next = index + 1
  if (next < candidates.length) {
    img.dataset.profileIndex = String(next)
    img.src = candidates[next]
    return true
  }
  img.style.display = 'none'
  const fallback = img.nextElementSibling as HTMLElement | null
  if (fallback) fallback.style.display = 'grid'
  return false
}
