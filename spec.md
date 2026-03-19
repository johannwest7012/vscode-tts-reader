# TTS VSCode Extension — Product Spec

## Overview

A lightweight VSCode extension that reads text aloud using OpenAI TTS. BYOK, no cursor movement, works everywhere.

## Core Requirements

### Reading

- Read selected text when a selection exists
- Read the entire file when nothing is selected
- Works in both raw editor view AND markdown preview
- Strips markdown formatting before sending to TTS (same logic as `tts-stop-hook.sh`)
- Truncates to 4000 chars to stay within OpenAI API limits

### Audio

- OpenAI TTS API (`gpt-4o-mini-tts` model)
- Configurable voice (default `fable`)
- Configurable speed (default `1.0`)
- Non-blocking — audio plays without freezing the editor
- Only one playback at a time — starting a new read kills the current one

### Controls

- `Cmd+Shift+R` — read selection or file
- `Cmd+Shift+X` — stop audio immediately
- Both also available via right-click context menu and command palette

### Configuration (VSCode Settings)

```json
"tts.openaiApiKey": "",        // stored in SecretStorage, not plaintext
"tts.voice": "fable",          // alloy | echo | fable | onyx | nova | shimmer | coral
"tts.speed": 1.0,              // 0.25 - 4.0
"tts.model": "gpt-4o-mini-tts" // or tts-1 / tts-1-hd
```

### Toggle

- Command palette: `TTS: Enable` / `TTS: Disable`
- Status bar item showing current state (`TTS ✓` / `TTS ✗`) — clickable to toggle
- Persists across sessions via VSCode workspace state

## What It Must NOT Do

- Move the cursor
- Scroll the editor
- Highlight or decorate text
- Require any external dependencies beyond Node.js (no Python, no shell scripts)
- Store the API key in plaintext settings

## Technical Approach

- Pure TypeScript VSCode extension
- Call OpenAI TTS API via Node.js `https` module (no external npm deps for the API call)
- Write audio to a temp file, play via `afplay` (macOS) with child process — same proven pattern as the hook script
- Extract text from markdown preview via `vscode.window.activeTextEditor` fallback to webview message passing
- Package with `vsce`

## Out of Scope (v1)

- Windows/Linux audio playback (macOS only for now)
- Streaming/chunked playback for long documents
- Custom voice instructions field (can add later)
- ElevenLabs or other provider support

## Success Criteria

- Read a full markdown file in preview mode without touching the cursor
- Read selected text in any file type
- Stop audio instantly on command
- API key survives VSCode restart without being visible in settings JSON

---

That's tight enough for Claude Code to run with. A few things I want to flag before you hand it off:

**The preview mode text extraction** is the hardest part. Getting text out of the markdown preview requires message passing between the webview and the extension host — Claude Code will likely need a few iterations on that. Worth keeping an eye on.

**afplay is macOS only** — that's fine for you but worth noting in the README so you don't get issue spam if you publish it.

**SecretStorage for the API key** — make sure Claude Code uses `context.secrets.store()` not `vscode.workspace.getConfiguration()` for the key. It's easy to accidentally put it in plaintext settings.

Want to add or change anything before you take this to Claude Code?
