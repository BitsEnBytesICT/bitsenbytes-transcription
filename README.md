# openrouter-dictation

Voice dictation built into Claude Code (desktop app Code tab and terminal). A bar above the prompt box records your microphone, sends the audio to OpenRouter's speech-to-text API with **your own key**, and inserts the transcript at the cursor in the prompt box. No second app, nothing to install.

- **One button**: the mic starts recording. While you talk, the bar shows an animated waveform with `■` (stop and transcribe) and `✕` (discard). You can also type `/dictate` to toggle, or `/dictate cancel` to discard.
- **Folding settings**: the chevron opens a drawer with the model picker, the language picker, the speaker-labels toggle and the API key field.
- **Model picker**: every OpenRouter transcription model (ElevenLabs Scribe v2 by default, plus Whisper, GPT-4o Transcribe, Voxtral, Deepgram Nova-3, and more), loaded live from OpenRouter.
- **Language picker**: auto-detect, or force a language (English, Nederlands, Deutsch, …).
- **Speaker labels**: the people icon in the drawer turns on speaker recognition (diarization). The transcript is then split into `Speaker 1: …` / `Speaker 2: …` lines; a single voice stays unlabelled. Only some models can do this. When one can't, the recording is transcribed again without labels and that model is remembered, so later recordings skip the refused request.
- Recording uses Windows' built-in audio API (winmm via PowerShell), so it needs Windows 10 or 11 and a microphone. Recordings stop after 10 minutes, and temp WAVs in `%TEMP%\claude-dictation` are cleaned up after an hour.

Icons are from [Lucide](https://lucide.dev) (ISC licence).

## API key

Use any one of these. The first one found wins:

1. Paste it into the key field in the bar's settings drawer. It's saved for this computer in the mod's local store.
2. Fill in the plugin's `apiKey` option when installing. It's kept in secure storage.
3. Set the `OPENROUTER_API_KEY` environment variable.

## Install

In the Claude desktop app: click **+** next to the prompt box, then **Plugins**, then **Add marketplace** with `BitsEnBytesICT/bitsenbytes-transcription`, then **Add plugin**.

At the prompt of a terminal session:

```
/plugin install openrouter-dictation --marketplace BitsEnBytesICT/bitsenbytes-transcription
```

Answer `y` to add the marketplace, then pick a scope (user is the first). From a shell:

```
claude plugin install openrouter-dictation --marketplace BitsEnBytesICT/bitsenbytes-transcription
```

To update later: `claude plugin update openrouter-dictation`, then `/reload-plugins`.
