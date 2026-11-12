export const SONG_CATEGORIES = ['한국노래', '중국노래', 'KPOP', 'JPOP'] as const

export type SongCategory = typeof SONG_CATEGORIES[number]
