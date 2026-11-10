import { expect, test } from 'claude-code/testing'

import { refusesDiarization, speakerTurns } from './speakers'

test('labelled words become numbered speaker turns, in the order speakers first talk', () => {
  const words = [
    { word: 'Hi', speaker: 3 },
    { word: 'there', speaker: 3 },
    { word: '.', speaker: 3 },
    { word: 'Hello', speaker: 1 },
    { word: ',', speaker: 1 },
    { word: 'you', speaker: 1 },
    { word: 'Bye', speaker: 3 },
  ]

  expect(speakerTurns({ text: 'Hi there. Hello, you Bye', words })).toBe(
    'Speaker 1: Hi there.\nSpeaker 2: Hello, you\nSpeaker 1: Bye',
  )
})

test('string labels count as speakers, and one voice reads without a label', () => {
  const words = [
    { word: 'Just', speaker_label: 'speaker_0' },
    { word: 'me', speaker_label: 'speaker_0' },
    { word: 'here', speaker_label: 'speaker_0' },
  ]

  expect(speakerTurns({ words })).toBe('Just me here')
})

test('segments stand in where words carry no speakers', () => {
  const segments = [
    { text: 'First part.', speaker: 0 },
    { text: 'Second part.', speaker: 1 },
  ]

  expect(speakerTurns({ words: [{ word: 'First' }], segments })).toBe('Speaker 1: First part.\nSpeaker 2: Second part.')
})

test('a transcript without labels has no speaker turns', () => {
  expect(speakerTurns({ text: 'plain' })).toBe(undefined)
})

test('only a 400 about diarization counts as the model refusing speaker labels', () => {
  expect(refusesDiarization(400, 'The selected model cannot diarize')).toBe(true)
  expect(refusesDiarization(400, 'language not supported')).toBe(false)
  expect(refusesDiarization(500, 'diarize failed upstream')).toBe(false)
})
