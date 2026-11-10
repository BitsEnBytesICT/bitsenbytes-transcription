// Speaker recognition (diarization): OpenRouter labels each word of a
// verbose_json transcript with the speaker who said it. These turn those
// labels into "Speaker 1: ..." lines.

type Labelled = { text?: unknown; word?: unknown; speaker?: unknown; speaker_label?: unknown }

export type VerboseTranscript = {
  text?: unknown
  words?: Labelled[]
  segments?: Labelled[]
}

function speakerOf(piece: Labelled): string | undefined {
  if (typeof piece.speaker_label === 'string' && piece.speaker_label) return piece.speaker_label
  if (typeof piece.speaker === 'number') return String(piece.speaker)
  return undefined
}

// Joins word pieces as speech reads: no space before punctuation.
function joinWords(words: string[]): string {
  return words
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.!?;:%)\]}])/g, '$1')
    .replace(/([(\[{]) /g, '$1')
    .trim()
}

// Turns of consecutive pieces by one speaker, numbered in the order the
// speakers first talk. Undefined when the transcript carries no labels.
function turns(pieces: Labelled[], textOf: (piece: Labelled) => string): string | undefined {
  const numbers = new Map<string, number>()
  const lines: { speaker: number; words: string[] }[] = []
  for (const piece of pieces) {
    const text = textOf(piece).trim()
    const label = speakerOf(piece)
    if (!text || label === undefined) continue
    if (!numbers.has(label)) numbers.set(label, numbers.size + 1)
    const speaker = numbers.get(label) ?? 1
    const last = lines[lines.length - 1]
    if (last && last.speaker === speaker) last.words.push(text)
    else lines.push({ speaker, words: [text] })
  }
  if (lines.length === 0) return undefined
  // One voice throughout reads better without a label.
  if (numbers.size === 1) return joinWords(lines.flatMap(line => line.words))
  return lines.map(line => `Speaker ${line.speaker}: ${joinWords(line.words)}`).join('\n')
}

export function speakerTurns(body: VerboseTranscript): string | undefined {
  const words = Array.isArray(body.words) ? body.words : []
  const segments = Array.isArray(body.segments) ? body.segments : []
  return (
    turns(words, piece => (typeof piece.word === 'string' ? piece.word : '')) ??
    turns(segments, piece => (typeof piece.text === 'string' ? piece.text : ''))
  )
}

// A 400 that names diarization: the model cannot label speakers.
export function refusesDiarization(status: number, message: string): boolean {
  return status === 400 && /diari[sz]|speaker/i.test(message)
}
