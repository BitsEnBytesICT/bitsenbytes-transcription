import { atom, read, update } from 'claude-code'
import type { EngineInterface, FsBytes, Register } from 'claude-code'

import type { DictationModel, DictationPhase } from '../types'
import { RECORD_SCRIPT } from './recorder'
import { ICON_SIZE, icon } from './icons'
import type { IconName, IconTone } from './icons'
import { refusesDiarization, speakerTurns } from './speakers'
import type { VerboseTranscript } from './speakers'
import { WAVE_HEIGHT, WAVE_WIDTH, recordingWave, transcribingWave } from './wave'

const API = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = 'elevenlabs/scribe-v2'
const MAX_SECONDS = 600
// Model, language, key: what the open drawer shows.
const DRAWER_ITEMS = 3
// U+FE0E asks for the monochrome text glyph rather than the colour emoji.
const MIC = '\u{1F399}\uFE0E'
// Braille blanks: a click target as wide as an icon that draws nothing.
const HIT_AREA = '\u2800\u2800'

const phase = atom({ plugin: 'openrouter-dictation', key: 'phase' } as const, 'idle' as DictationPhase)
const notice = atom({ plugin: 'openrouter-dictation', key: 'notice' } as const, null as string | null)
const model = atom({ plugin: 'openrouter-dictation', key: 'model' } as const, DEFAULT_MODEL)
const language = atom({ plugin: 'openrouter-dictation', key: 'language' } as const, '')
const models = atom({ plugin: 'openrouter-dictation', key: 'models' } as const, [] as DictationModel[])
const hasKey = atom({ plugin: 'openrouter-dictation', key: 'hasKey' } as const, false)
const isEditingKey = atom({ plugin: 'openrouter-dictation', key: 'isEditingKey' } as const, false)
const drawer = atom({ plugin: 'openrouter-dictation', key: 'drawer' } as const, 0)
const speakers = atom({ plugin: 'openrouter-dictation', key: 'speakers' } as const, false)

// Shown until the live list from OpenRouter arrives.
const FALLBACK_MODELS: DictationModel[] = [
  { id: 'elevenlabs/scribe-v2', name: 'ElevenLabs: Scribe v2' },
  { id: 'openai/gpt-4o-transcribe', name: 'OpenAI: GPT-4o Transcribe' },
  { id: 'openai/gpt-4o-mini-transcribe', name: 'OpenAI: GPT-4o Mini Transcribe' },
  { id: 'openai/whisper-large-v3-turbo', name: 'OpenAI: Whisper Large V3 Turbo' },
  { id: 'mistralai/voxtral-mini-transcribe', name: 'Mistral: Voxtral Mini Transcribe' },
  { id: 'deepgram/nova-3', name: 'Deepgram: Nova-3' },
]

const LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'pl', label: 'Polski' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'uk', label: 'Українська' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
]

type Recording = {
  wavPath: string
  stopPath: string
  isCancelled: boolean
}

type Defaults = { apiKey: string; model: string; language: string; speakers: boolean }

// The manifest's userConfig values, set each time the module registers.
let defaults: Defaults = { apiKey: '', model: DEFAULT_MODEL, language: '', speakers: false }
let recording: Recording | undefined

async function say($: EngineInterface, text: string | null) {
  await update($, notice, () => text)
}

// A passing message clears itself; errors stay until the next action.
async function sayBriefly($: EngineInterface, text: string) {
  await say($, text)
  $.clock.after(4000, () => {
    void update($, notice, current => (current === text ? null : current))
  })
}

// The key pasted into the drawer wins, then the userConfig one, then the
// OPENROUTER_API_KEY environment variable.
async function apiKey($: EngineInterface): Promise<string | undefined> {
  const stored = await $.store.get('apiKey')
  if (typeof stored === 'string' && stored.trim()) return stored.trim()
  if (defaults.apiKey) return defaults.apiKey
  const env = await $.env.get('OPENROUTER_API_KEY')
  return env?.trim() || undefined
}

async function loadModels($: EngineInterface) {
  try {
    const res = await $.http.fetch(`${API}/models?output_modalities=transcription`)
    if (!res.ok) return
    const body = JSON.parse(res.text) as { data?: { id?: unknown; name?: unknown }[] }
    const list = (body.data ?? [])
      .filter(m => typeof m.id === 'string')
      .map(m => ({ id: String(m.id), name: typeof m.name === 'string' ? m.name : String(m.id) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (list.length === 0) return
    await update($, models, () => list)
    await $.store.set('models', list)
  } catch {
    // Offline or blocked: the cached or fallback list stays.
  }
}

// Opens or folds the drawer in one redraw, so the row never jumps.
async function fold($: EngineInterface, isOpening: boolean) {
  await update($, drawer, () => (isOpening ? DRAWER_ITEMS : 0))
}

async function start($: EngineInterface) {
  if ((await read($, phase)) !== 'idle') return
  if ((await $.env.get('OS')) !== 'Windows_NT') {
    await say($, 'Recording uses the Windows audio API, so it only works on Windows for now.')
    return
  }
  if (!(await apiKey($))) {
    await update($, isEditingKey, () => true)
    await fold($, true)
    await say($, 'Add your OpenRouter API key to start dictating.')
    return
  }
  const temp = (await $.env.get('TEMP')) ?? (await $.env.get('TMP'))
  if (!temp) {
    await say($, 'Could not find the TEMP folder to record into.')
    return
  }
  const folder = `${temp}\\claude-dictation`
  const scriptPath = `${folder}\\record.ps1`
  await $.fs.write(scriptPath, RECORD_SCRIPT)
  const id = String(await $.clock.now())
  const current: Recording = {
    wavPath: `${folder}\\rec-${id}.wav`,
    stopPath: `${folder}\\rec-${id}.stop`,
    isCancelled: false,
  }
  recording = current
  const systemRoot = (await $.env.get('SystemRoot')) ?? 'C:\\Windows'
  const powershell = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`

  await update($, phase, () => 'starting')
  await say($, null)
  if ((await read($, drawer)) > 0) await fold($, false)

  const child = $.process.spawn({
    argv: [
      powershell, '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath, '-Out', current.wavPath, '-Stop', current.stopPath,
      '-MaxSeconds', String(MAX_SECONDS),
    ],
  })

  // The loop is the recorder's life; it runs on after the press returns and
  // ends when the script has saved the WAV (or failed).
  void (async () => {
    let isSaved = false
    let errors = ''
    try {
      for await (const chunk of child) {
        if (chunk.stream === 'stderr') {
          errors += chunk.text
          continue
        }
        if (chunk.text.includes('RECORDING') && (await read($, phase)) === 'starting') {
          await update($, phase, () => 'recording')
        }
        if (chunk.text.includes('SAVED')) isSaved = true
      }
    } catch (error) {
      errors += String(error)
    }
    if (recording === current) recording = undefined
    await finish($, current, isSaved, errors)
  })()
}

async function stop($: EngineInterface, isCancelled: boolean) {
  const current = recording
  if (!current) return
  current.isCancelled = isCancelled
  await $.fs.write(current.stopPath, isCancelled ? 'cancel' : 'stop')
  if (!isCancelled) await update($, phase, () => 'transcribing')
}

async function toggle($: EngineInterface) {
  const now = await read($, phase)
  if (now === 'idle') await start($)
  else if (now === 'recording' || now === 'starting') await stop($, false)
}

async function finish($: EngineInterface, current: Recording, isSaved: boolean, errors: string) {
  try {
    if (current.isCancelled) return
    if (!isSaved) {
      const reason = errors.split('\n').find(line => line.trim())?.trim() ?? 'the recorder stopped unexpectedly'
      await say($, `Recording failed: ${reason.slice(0, 240)}`)
      return
    }
    await update($, phase, () => 'transcribing')
    const audio = (await $.fs.read(current.wavPath, { as: 'bytes' })) as FsBytes
    // Under ~0.3 s of 16 kHz audio is a click, not speech.
    if (audio.base64.length < 14000) {
      await sayBriefly($, 'Nothing was recorded. Is a microphone connected?')
      return
    }
    const key = await apiKey($)
    if (!key) {
      await say($, 'Add your OpenRouter API key to start dictating.')
      return
    }
    const modelId = await read($, model)
    const lang = await read($, language)
    const wantsSpeakers = await read($, speakers)
    const canLabel = wantsSpeakers && !(await cannotLabelSpeakers($, modelId))
    let reply = await transcribe($, key, audio.base64, modelId, lang, canLabel)
    // A model that cannot diarize refuses the whole request: remember it and
    // transcribe the same audio again without speaker labels.
    let isUnlabelled = wantsSpeakers && !canLabel
    if (canLabel && refusesDiarization(reply.status, reply.error)) {
      await rememberCannotLabel($, modelId)
      isUnlabelled = true
      reply = await transcribe($, key, audio.base64, modelId, lang, false)
    }
    if (!reply.ok) {
      await say($, `OpenRouter ${reply.status}: ${reply.error}`)
      if (reply.status === 401) {
        await update($, isEditingKey, () => true)
        await fold($, true)
      }
      return
    }
    const plain = typeof reply.body.text === 'string' ? reply.body.text.trim() : ''
    const text = (canLabel && !isUnlabelled ? speakerTurns(reply.body) : undefined) ?? plain
    if (!text) {
      await sayBriefly($, 'No speech was recognised.')
      return
    }
    await insert($, text)
    if (isUnlabelled) await sayBriefly($, `${modelId} can't label speakers, so this was transcribed without them.`)
  } catch (error) {
    await say($, `Transcription failed: ${String(error).slice(0, 240)}`)
  } finally {
    await update($, phase, () => 'idle')
  }
}

type Reply = { ok: boolean; status: number; error: string; body: VerboseTranscript }

// One request to OpenRouter's speech-to-text endpoint. Speaker labels need
// the verbose form, which carries each word with its speaker.
async function transcribe(
  $: EngineInterface,
  key: string,
  base64: string,
  modelId: string,
  lang: string,
  labelSpeakers: boolean,
): Promise<Reply> {
  const res = await $.http.fetch(`${API}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Title': 'Claude Code Dictation',
    },
    body: JSON.stringify({
      model: modelId,
      input_audio: { data: base64, format: 'wav' },
      ...(lang ? { language: lang } : {}),
      ...(labelSpeakers ? { diarize: true, response_format: 'verbose_json' } : {}),
    }),
  })
  let body: VerboseTranscript & { error?: { message?: unknown } } = {}
  try {
    body = JSON.parse(res.text)
  } catch {
    // Not JSON: reported by status.
  }
  const error = typeof body.error?.message === 'string' ? body.error.message : res.ok ? '' : res.text.slice(0, 200)
  return { ok: res.ok, status: res.status, error, body }
}

// Models that refused diarization once, kept on this computer so the next
// recording does not pay for a refused request first.
async function cannotLabelSpeakers($: EngineInterface, modelId: string): Promise<boolean> {
  const known = await $.store.get('cannotLabelSpeakers')
  return Array.isArray(known) && known.includes(modelId)
}

async function rememberCannotLabel($: EngineInterface, modelId: string) {
  const known = await $.store.get('cannotLabelSpeakers')
  const list = Array.isArray(known) ? known.filter((id): id is string => typeof id === 'string') : []
  if (!list.includes(modelId)) await $.store.set('cannotLabelSpeakers', [...list, modelId])
}

async function toggleSpeakers($: EngineInterface) {
  const isOn = !(await read($, speakers))
  await update($, speakers, () => isOn)
  await $.store.set('speakers', isOn)
  const modelId = await read($, model)
  if (isOn && (await cannotLabelSpeakers($, modelId))) {
    await sayBriefly($, `Speaker labels on, but ${modelId} can't label speakers. Pick another model to use them.`)
  } else {
    await sayBriefly($, isOn ? 'Speaker labels on: Speaker 1, Speaker 2, …' : 'Speaker labels off')
  }
}

// Puts the transcript at the caret, with a space either side where the
// draft's text would otherwise run into it.
async function insert($: EngineInterface, text: string) {
  const box = await $.prompt.read()
  const before = box.text.slice(0, box.cursor)
  const after = box.text.slice(box.cursor)
  const lead = before && !/\s$/.test(before) ? ' ' : ''
  const tail = after && !/^\s/.test(after) ? ' ' : ''
  const filled = await $.prompt.fill({ text: lead + text + tail, mode: 'insert' })
  if (!filled.isFilled) {
    await $.ui.copy({ text })
    $.ui.toast('The prompt box was busy, so the transcript is on your clipboard.')
  }
}

async function saveKey($: EngineInterface, value: string) {
  const key = value.trim()
  if (!key) return
  await $.store.set('apiKey', key)
  await update($, hasKey, () => true)
  await update($, isEditingKey, () => false)
  await sayBriefly($, 'Key saved on this computer.')
}

async function pickModel($: EngineInterface, value: string) {
  await update($, model, () => value)
  await $.store.set('model', value)
}

async function pickLanguage($: EngineInterface, value: string) {
  await update($, language, () => value)
  await $.store.set('language', value)
}

export const register: Register = (on, options) => {
  defaults = {
    apiKey: typeof options.apiKey === 'string' ? options.apiKey.trim() : '',
    model: typeof options.model === 'string' && options.model.trim() ? options.model.trim() : DEFAULT_MODEL,
    language: typeof options.language === 'string' ? options.language.trim() : '',
    speakers: options.speakers === true,
  }

  on('session.start', async ($, e, next) => {
    const storedModel = await $.store.get('model')
    const storedLanguage = await $.store.get('language')
    const storedModels = await $.store.get('models')
    const storedSpeakers = await $.store.get('speakers')
    await update($, speakers, () => (typeof storedSpeakers === 'boolean' ? storedSpeakers : defaults.speakers))
    await update($, model, () => (typeof storedModel === 'string' && storedModel ? storedModel : defaults.model))
    await update($, language, () => (typeof storedLanguage === 'string' ? storedLanguage : defaults.language))
    await update($, models, () =>
      Array.isArray(storedModels) && storedModels.length ? (storedModels as DictationModel[]) : FALLBACK_MODELS,
    )
    const key = await apiKey($)
    await update($, hasKey, () => Boolean(key))
    // A message from before a reload is stale.
    await update($, notice, () => null)
    // A reload mid-recording drops the recorder child with the old module.
    if ((await read($, phase)) !== 'idle') await update($, phase, () => 'idle')
    void loadModels($)
    await $.command.register({
      name: 'dictate',
      description: 'Start or stop voice dictation (OpenRouter speech-to-text)',
      argumentHint: '[cancel]',
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'dictate' }, async ($, e) => {
    if (e.args.trim() === 'cancel') await stop($, true)
    else await toggle($)

    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'terminal') return next(e)

    const { Box, Button, Text, Select, Input } = $.ui.resolve(e)
    // The terminal has no Svg: it draws glyphs and a block-character waveform.
    const Svg = e.surface === 'desktop' ? $.ui.resolve(e).Svg : undefined
    const now = await read($, phase)
    const message = await read($, notice)
    const shown = await read($, drawer)

    // A Button holds text alone, so on the desktop the icon is an Svg with a
    // blank, borderless Button centred over it to take the click; its hover
    // then lights a square around the icon. Every face stays drawn and only
    // the shown one is displayed, so switching faces reloads no image.
    const iconButton = (
      key: string,
      glyph: string,
      onPress: () => unknown,
      faces: { name: IconName; tone?: IconTone; isShown?: boolean }[],
    ) =>
      Svg ? (
        <Box width={3} alignItems="center" justifyContent="center">
          {faces.map(face => (
            <Box display={face.isShown === false ? 'none' : 'flex'}>
              <Svg source={icon(face.name, face.tone)} alt={key} width={ICON_SIZE} height={ICON_SIZE} />
            </Box>
          ))}
          <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
            <Button key={key} label={HIT_AREA} plain onPress={() => void onPress()} />
          </Box>
        </Box>
      ) : (
        <Button key={key} label={glyph} plain dimColor={faces[0]?.tone !== 'strong'} onPress={() => void onPress()} />
      )

    const wave = (source: string, alt: string) =>
      Svg ? (
        <Svg source={source} alt={alt} width={WAVE_WIDTH} height={WAVE_HEIGHT} isInteractive />
      ) : (
        <Text dimColor>{alt === 'Recording' ? '▁▃▅▇▅▃▁' : '· · ·'}</Text>
      )

    const footer = message !== null && (
      <Text dimColor size="footnote">
        {message}
      </Text>
    )

    if (now !== 'idle') {
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={1} alignItems="center">
            {now === 'recording' && wave(recordingWave(), 'Recording')}
            {now !== 'recording' && wave(transcribingWave(), now === 'transcribing' ? 'Transcribing' : 'Starting')}
            {now !== 'transcribing' && iconButton('stop', '■', () => stop($, false), [{ name: 'stop', tone: 'accent' }])}
            {now !== 'transcribing' && iconButton('cancel', '✕', () => stop($, true), [{ name: 'x' }])}
          </Box>
          {footer}
        </Box>
      )
    }

    const modelId = await read($, model)
    const lang = await read($, language)
    const stored = await read($, models)
    const list = stored.length ? stored : FALLBACK_MODELS
    const keyIsSet = await read($, hasKey)
    const isKeyOpen = (await read($, isEditingKey)) || !keyIsSet
    const modelOptions = list.some(m => m.id === modelId)
      ? list.map(m => ({ value: m.id, label: m.name }))
      : [{ value: modelId, label: modelId }, ...list.map(m => ({ value: m.id, label: m.name }))]
    const isOpen = shown > 0
    const labelsSpeakers = await read($, speakers)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
          {iconButton('mic', MIC, () => start($), [{ name: 'mic', tone: 'strong' }])}
          {iconButton('chevron', isOpen ? '‹' : '›', () => fold($, !isOpen), [
            { name: 'chevronRight', isShown: !isOpen },
            { name: 'chevronDown', isShown: isOpen },
          ])}
          {shown >= 1 && (
            <Select key="model" options={modelOptions} value={modelId} onSelect={value => pickModel($, value)} />
          )}
          {shown >= 2 && (
            <Select key="language" options={LANGUAGES} value={lang} onSelect={value => pickLanguage($, value)} />
          )}
          {shown >= 2 &&
            iconButton('speakers', labelsSpeakers ? 'speakers ✓' : 'speakers', () => toggleSpeakers($), [
              { name: 'users', isShown: !labelsSpeakers },
              { name: 'users', tone: 'accent', isShown: labelsSpeakers },
            ])}
          {shown >= 3 && !isKeyOpen && iconButton('change-key', 'key', () => update($, isEditingKey, () => true), [{ name: 'key' }])}
          {shown >= 3 && isKeyOpen && (
            <Input
              key="api-key"
              placeholder="OpenRouter key  sk-or-v1-…"
              submitLabel="save"
              onSubmit={value => saveKey($, value)}
            />
          )}
          {shown >= 3 && isKeyOpen && keyIsSet && iconButton('close-key', '✕', () => update($, isEditingKey, () => false), [{ name: 'x' }])}
        </Box>
        {footer}
      </Box>
    )
  })
}
