# openrouter-dictation

Voice dictation built into Claude Code, in the desktop app's Code tab and in the terminal. A small bar above the prompt box records your microphone, sends the audio to OpenRouter's speech-to-text API with **your own key**, and puts the transcript at the cursor in the prompt box. No second app, nothing else to install.

## Requirements

- **Windows 10 or 11** with a working microphone. Recording uses Windows' built-in audio API (winmm through PowerShell), so it doesn't work on macOS or Linux.
- **Claude Code**: the Claude desktop app's **Code** tab, or `claude` in a terminal. The bar doesn't show in the Chat tab, in cloud sessions or in the phone app.
- **An OpenRouter API key** from [openrouter.ai/keys](https://openrouter.ai/keys), with some credit on the account. Transcription is billed per minute of audio by OpenRouter.

## Install in the Claude desktop app

1. Open the **Code** tab.
2. Click **+** next to the prompt box, then choose **Plugins**.
3. Choose **Add marketplace** and enter:
   ```
   BitsEnBytesICT/bitsenbytes-transcription
   ```
4. Find **openrouter-dictation** in the list and click **Add plugin** (or **Install**).
5. **Start a new session.** Plugins load when a session starts, so a session that was already open won't show the bar. You can also type `/reload-plugins` in an open session.

## Install from a terminal

At the prompt of a `claude` session:

```
/plugin install openrouter-dictation --marketplace BitsEnBytesICT/bitsenbytes-transcription
```

Answer `y` to add the marketplace, then pick a scope (**user** is the first one and makes it work in every project). Or from a shell:

```
claude plugin install openrouter-dictation --marketplace BitsEnBytesICT/bitsenbytes-transcription
```

## First use

1. In a new session, send your first message, then look just **above the prompt box**. (The bar can't appear before the first message; see Troubleshooting.) You'll see a mic icon and a chevron (`›`).
2. Click the **chevron** to open the settings drawer, then click the **key** icon and paste your OpenRouter key. Press Enter to save. It's kept on this computer, so you only do this once. If you click the mic without a key, the drawer opens on the key field for you.
3. Pick a **model** in the drawer if you want something other than ElevenLabs Scribe v2, and a **language** if auto-detect gets it wrong.
4. Click the **mic** and talk. The bar turns into a moving waveform.
5. Click **■** to stop. The bar shimmers while it transcribes, then the text appears in the prompt box at your cursor. Click **✕** instead to throw the recording away.

You can also type `/dictate` to start or stop, and `/dictate cancel` to discard.

## Features

- **One button**: only the mic is visible. Everything else is folded into the chevron drawer.
- **Model picker**: every OpenRouter transcription model (ElevenLabs Scribe v2 by default, plus Whisper, GPT-4o Transcribe, Voxtral, Deepgram Nova-3 and more), loaded live from OpenRouter.
- **Language picker**: auto-detect, or force a language (English, Nederlands, Deutsch, …).
- **Speaker labels**: the people icon in the drawer turns on speaker recognition (diarization). The transcript is then split into `Speaker 1: …` / `Speaker 2: …` lines, and a single voice stays unlabelled. Only some models can do this. When a model can't, the recording is transcribed again without labels and that model is remembered, so later recordings skip the refused request.
- Recordings stop by themselves after 10 minutes. Temporary WAV files in `%TEMP%\claude-dictation` are cleaned up after an hour.

Icons are from [Lucide](https://lucide.dev) (ISC licence).

## API key

Use any one of these. The first one found wins:

1. Paste it into the key field in the bar's settings drawer. It's saved for this computer in the plugin's local store.
2. Fill in the plugin's `apiKey` option when installing. It's kept in secure storage.
3. Set the `OPENROUTER_API_KEY` environment variable.

## Troubleshooting

- **The bar only shows up after my first message in a new chat.** That's how the desktop app works: a new chat doesn't start Claude Code until you send something, and plugins run inside it. Send any short message first, or type `/dictate` as your first message to start the chat and a recording in one go. After that the bar stays for the whole chat.
- **I don't see the bar.** Start a new session in the **Code** tab, or type `/reload-plugins`. Make sure the plugin is turned on under **+**, then **Plugins**. The bar hides while a survey or question card is showing above the prompt box.
- **It says recording needs Windows.** It does. On a Mac or Linux machine, the plugin installs but can't record.
- **Nothing was recorded.** Check that Windows lets apps use the microphone: Settings, then Privacy & security, then Microphone. Also check that the right input device is the default.
- **The key field opens again.** OpenRouter rejected the key (401). Paste a fresh key from openrouter.ai/keys.

## Update

```
claude plugin update openrouter-dictation
```

Then `/reload-plugins` or start a new session.
