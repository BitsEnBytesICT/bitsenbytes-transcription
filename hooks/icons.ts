// Icons from Lucide (https://lucide.dev, ISC licence), drawn as SVG on the
// desktop surface in the muted tone of Claude's own toolbar icons.

export const ICON_SIZE = 16

const PATHS = {
  mic:
    '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>' +
    '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
    '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  stop: '<rect width="14" height="14" x="5" y="5" rx="2.5" fill="currentColor" stroke="none"/>',
  key:
    '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/>' +
    '<circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
} as const

export type IconName = keyof typeof PATHS

const TONE = {
  muted: '<style>svg{color:#73726c}@media (prefers-color-scheme:dark){svg{color:#b7b5a9}}</style>',
  strong: '<style>svg{color:#3d3d3a}@media (prefers-color-scheme:dark){svg{color:#f0eee6}}</style>',
  accent: '<style>svg{color:#c96442}@media (prefers-color-scheme:dark){svg{color:#d97757}}</style>',
} as const

export type IconTone = keyof typeof TONE

export function icon(name: IconName, tone: IconTone = 'muted'): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" ` +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    TONE[tone] +
    PATHS[name] +
    '</svg>'
  )
}
