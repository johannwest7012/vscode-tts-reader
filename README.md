# OpenAI TTS Reader

A lightweight VSCode extension that reads text aloud using OpenAI's text-to-speech API. Bring your own API key — no cursor movement, no editor disruption.

## Features

- **Read selected text** or the entire file with a single shortcut
- **Chunked playback** — audio starts fast, even for long documents
- **Sidebar settings panel** — configure voice, speed, model, and API key from the activity bar
- **Markdown-aware** — strips formatting before reading so you hear clean prose
- **Right-click context menu** — read or stop from the editor context menu
- **Status bar toggle** — enable/disable TTS with a click

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Read selection or file | `Cmd+Shift+R` |
| Stop playback | `Cmd+Escape` |

Both commands are also available via the command palette (`Cmd+Shift+P`) and the editor right-click menu.

## Setup

1. Install the extension
2. Open the TTS sidebar (speaker icon in the activity bar)
3. Enter your [OpenAI API key](https://platform.openai.com/api-keys)
4. Select text and press `Cmd+Shift+R`

Your API key is stored securely in VSCode's SecretStorage — it never appears in plaintext settings files.

## Settings

Configure from the sidebar or VSCode settings:

| Setting | Default | Options |
|---------|---------|---------|
| Voice | `fable` | alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer |
| Speed | `1.0` | 0.25 – 4.0 |
| Model | `gpt-4o-mini-tts` | gpt-4o-mini-tts, tts-1, tts-1-hd |

## Requirements

- **macOS** — audio playback uses `afplay` (Windows/Linux not yet supported)
- **OpenAI API key** with access to the TTS API
- **Node.js** — no other external dependencies

## How It Works

Text is split into ~600 character chunks at sentence boundaries. The first chunk is sent to the OpenAI TTS API and played immediately, while the next chunk is prefetched in the background. This keeps time-to-audio low even for long documents.

For markdown files, formatting (headers, bold, links, etc.) is stripped before sending to the API so the speech output sounds natural.

## Limitations

- macOS only (v1)
- Markdown preview mode reads the full source file — text selection in preview is not supported
- Text is capped at 4000 characters per read

## License

MIT
