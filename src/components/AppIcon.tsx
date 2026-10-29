import type { ReactElement, SVGProps } from 'react'

export type AppIconName =
  | 'profile' | 'calendar' | 'music' | 'wardrobe' | 'upbo' | 'home'
  | 'external' | 'youtube' | 'cafe' | 'broadcast' | 'cake' | 'sprout'
  | 'clock' | 'heart' | 'crown' | 'play' | 'search' | 'chevron-left'
  | 'chevron-right' | 'grip' | 'edit' | 'trash' | 'plus' | 'settings'
  | 'sparkle' | 'image' | 'logout' | 'menu' | 'close'

const paths: Record<AppIconName, ReactElement> = {
  profile: <><circle cx="12" cy="8" r="3"/><path d="M5.5 19c.9-3.5 3-5 6.5-5s5.6 1.5 6.5 5"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M7 3.5v4M17 3.5v4M3.5 9.5h17"/></>,
  music: <><path d="M9 18V6.5l9-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="15.5" cy="15.5" r="2.5"/></>,
  wardrobe: <><path d="M8 5.5c0-2 1.2-3 4-3s4 1 4 3c0 1.4-1 2.3-2.5 2.8L20 12l-2 3-6-3-6 3-2-3 6.5-3.7C9 7.8 8 6.9 8 5.5Z"/><path d="M12 12v9"/></>,
  upbo: <><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V2.8h6V4M8 9h8M8 13h5M8 17h7"/></>,
  home: <><path d="m3.5 11 8.5-7 8.5 7"/><path d="M6 10.5V20h12v-9.5M10 20v-6h4v6"/></>,
  external: <><path d="M13 4h7v7M20 4l-9 9"/><path d="M17 13v6H5V7h6"/></>,
  youtube: <><path d="M20.2 8.2a2.6 2.6 0 0 0-1.8-1.8C16.8 6 12 6 12 6s-4.8 0-6.4.4a2.6 2.6 0 0 0-1.8 1.8C3.4 9.8 3.4 12 3.4 12s0 2.2.4 3.8a2.6 2.6 0 0 0 1.8 1.8C7.2 18 12 18 12 18s4.8 0 6.4-.4a2.6 2.6 0 0 0 1.8-1.8c.4-1.6.4-3.8.4-3.8s0-2.2-.4-3.8Z"/><path d="m10 9 5 3-5 3Z"/></>,
  cafe: <><path d="M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 4.5c0 1 1 1 1 2M12 4.5c0 1 1 1 1 2"/></>,
  broadcast: <><path d="M4 18h16M7 14a7 7 0 0 1 10 0M9.5 11.5a3.5 3.5 0 0 1 5 0"/><circle cx="12" cy="17" r="1"/></>,
  cake: <><path d="M5 11h14v9H5zM4 14c2 0 2-1.5 4-1.5S10 14 12 14s2-1.5 4-1.5S18 14 20 14"/><path d="M8 11V8M12 11V7M16 11V8"/></>,
  sprout: <><path d="M12 21v-9"/><path d="M12 13c-4.5 0-7-2.5-7-6 4.5 0 7 2.5 7 6ZM12 11c4.5 0 7-2.5 7-6-4.5 0-7 2.5-7 6Z"/></>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
  heart: <path d="M12 20S4 15.5 4 9.5C4 6.5 6 5 8.2 5c1.7 0 3 1 3.8 2.2C12.8 6 14.1 5 15.8 5 18 5 20 6.5 20 9.5 20 15.5 12 20 12 20Z"/>,
  crown: <><path d="m4 8 4 4 4-7 4 7 4-4-1.5 11h-13Z"/><path d="M6 19h12"/></>,
  play: <path d="m9 7 8 5-8 5Z"/>,
  search: <><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></>,
  'chevron-left': <path d="m14.5 6-6 6 6 6"/>,
  'chevron-right': <path d="m9.5 6 6 6-6 6"/>,
  grip: <><circle cx="8" cy="7" r="1"/><circle cx="16" cy="7" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="17" r="1"/><circle cx="16" cy="17" r="1"/></>,
  edit: <><path d="m5 16-.5 4 4-.5L19 9l-3.5-3.5Z"/><path d="m13.5 7.5 3.5 3.5"/></>,
  trash: <><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v6M14 10v6"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></>,
  sparkle: <><path d="M12 3c.6 4 2 5.4 6 6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.6 5.4-2 6-6Z"/><path d="M19 15c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3Z"/></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="2"/><path d="m5 17 4.5-4.5 3 3 2.5-2.5 4 4"/></>,
  logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
}

export function AppIcon({ name, ...props }: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
