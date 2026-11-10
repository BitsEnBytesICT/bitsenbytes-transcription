// The animated SVGs the desktop bar draws: a voice waveform of rounded bars
// while recording, and a soft shimmer over the same bars while transcribing.
// SMIL runs inside the surface's sandboxed frame, so nothing is redrawn.

const BARS = 17
const BAR = 3
const GAP = 3
const HEIGHT = 22
export const WAVE_WIDTH = BARS * (BAR + GAP) - GAP
export const WAVE_HEIGHT = HEIGHT

const STYLE =
  '<style>rect{fill:#3d3d3a}@media (prefers-color-scheme:dark){rect{fill:#f0eee6}}</style>'

// Taller in the middle, dots at the edges, as a voice meter reads.
function envelope(i: number): number {
  const t = (i - (BARS - 1) / 2) / ((BARS - 1) / 2)
  return 0.18 + 0.82 * Math.cos((t * Math.PI) / 2) ** 1.6
}

// A fixed pseudo-random per bar, so the drawing is the same on every render.
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function bar(i: number, heights: number[], dur: number, delay: number, opacity: number): string {
  const x = i * (BAR + GAP)
  const hs = heights.map(h => Math.max(BAR, Math.round(h * 10) / 10))
  const ys = hs.map(h => Math.round(((HEIGHT - h) / 2) * 10) / 10)
  const first = hs[0] ?? BAR
  const firstY = ys[0] ?? 0
  const spline = hs.slice(1).map(() => '0.45 0 0.55 1').join(';')
  const animate = (attr: string, values: number[]) =>
    `<animate attributeName="${attr}" values="${values.join(';')}" dur="${dur}s" begin="-${delay}s" repeatCount="indefinite" calcMode="spline" keySplines="${spline}"/>`
  return (
    `<rect x="${x}" y="${firstY}" width="${BAR}" height="${first}" rx="${BAR / 2}" opacity="${opacity}">` +
    animate('height', hs) +
    animate('y', ys) +
    '</rect>'
  )
}

export function recordingWave(): string {
  let body = ''
  for (let i = 0; i < BARS; i++) {
    const peak = envelope(i) * HEIGHT
    const low = BAR + jitter(i, 1) * peak * 0.25
    const mid = peak * (0.35 + jitter(i, 2) * 0.4)
    const high = peak * (0.75 + jitter(i, 3) * 0.25)
    const dur = 0.9 + jitter(i, 4) * 0.7
    const opacity = 0.45 + 0.55 * envelope(i)
    body += bar(i, [low, high, mid, high * 0.85, low], dur, jitter(i, 5) * dur, Math.round(opacity * 100) / 100)
  }
  return svg(body)
}

export function transcribingWave(): string {
  let body = ''
  for (let i = 0; i < BARS; i++) {
    const h = Math.max(BAR, envelope(i) * HEIGHT * 0.35)
    const x = i * (BAR + GAP)
    const y = Math.round(((HEIGHT - h) / 2) * 10) / 10
    body +=
      `<rect x="${x}" y="${y}" width="${BAR}" height="${Math.round(h * 10) / 10}" rx="${BAR / 2}" opacity="0.25">` +
      `<animate attributeName="opacity" values="0.25;0.95;0.25" dur="1.1s" begin="${(i * 0.055).toFixed(3)}s" repeatCount="indefinite"/>` +
      '</rect>'
  }
  return svg(body)
}

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WAVE_WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WAVE_WIDTH} ${HEIGHT}">${STYLE}${body}</svg>`
}
