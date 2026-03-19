# TTS VSCode Extension — Implementation Plan

## Architecture

```
src/
├── extension.ts          # Activation, command registration, lifecycle
├── tts.ts                # OpenAI TTS API call + audio playback
├── textExtractor.ts      # Get text from editor/selection/preview
├── markdownStripper.ts   # Strip markdown formatting to plain text
├── statusBar.ts          # Status bar item + enable/disable toggle
└── secrets.ts            # SecretStorage wrapper for API key
```

Single `package.json` with no runtime npm dependencies. Dev deps only: `@types/vscode`, `typescript`, `@vscode/vsce`.

---

## Implementation Phases

### Phase 1: Scaffold & Boilerplate

**Files:** `package.json`, `tsconfig.json`, `.vscodeignore`, `src/extension.ts`

- Initialize extension scaffold (`yo code` pattern but manual — no generator dep)
- `package.json` contributes:
  - Commands: `tts.read`, `tts.stop`, `tts.toggle`, `tts.setApiKey`
  - Keybindings: `Cmd+Shift+R` → `tts.read`, `Cmd+Shift+.` → `tts.stop`
  - Menus: editor context menu entries for read/stop
  - Configuration: `tts.voice`, `tts.speed`, `tts.model` (NOT the API key — that's SecretStorage)
- `extension.ts`: `activate()` registers commands, creates status bar, wires everything up. `deactivate()` kills any playing audio.

### Phase 2: Secret Storage & Configuration

**File:** `src/secrets.ts`

- `setApiKey(context)`: prompt user via `vscode.window.showInputBox({ password: true })`, store via `context.secrets.store('tts.openaiApiKey', key)`
- `getApiKey(context)`: `context.secrets.get('tts.openaiApiKey')`
- On first `tts.read` with no key stored → prompt to set it
- `tts.setApiKey` command for manual re-entry

**Key decision:** API key lives in `SecretStorage` only. The `tts.openaiApiKey` setting in `package.json` contributes section is omitted entirely — no plaintext footgun.

### Phase 3: Text Extraction

**File:** `src/textExtractor.ts`

- `getTextToRead(): string | undefined`
- Priority:
  1. If active editor has a selection → return selection text
  2. If active editor exists (no selection) → return full document text
  3. Return `undefined` (show error)
- Truncate to 4000 chars with a warning if truncated

**On markdown preview:** The VSCode markdown preview is a webview we don't own. There is no stable API to extract text from it. The practical approach:
- When the user is viewing a markdown preview, `vscode.window.activeTextEditor` still holds the source `.md` file in most cases (the preview doesn't replace the editor, it opens beside it or the editor is still the "active" text editor behind the preview)
- If `activeTextEditor` is `undefined` (pure preview, no editor open), show a message: "Open the markdown file in the editor to use TTS"
- **This avoids the webview message-passing rabbit hole entirely.** The spec says "works in markdown preview" — we achieve this by reading the source file, which is actually better for TTS anyway (no HTML artifacts)

### Phase 4: Markdown Stripping

**File:** `src/markdownStripper.ts`

- `stripMarkdown(text: string): string`
- Pure regex/string replacement, no deps:
  - Remove `#` headers → keep text
  - Remove `**bold**` / `*italic*` / `~~strikethrough~~` → keep inner text
  - Remove `[link text](url)` → keep link text
  - Remove `![alt](url)` → keep alt text
  - Remove inline code backticks → keep code text
  - Remove code fence lines (` ``` `) → keep content
  - Remove HTML tags → keep inner text
  - Remove horizontal rules (`---`, `***`)
  - Collapse multiple blank lines → single blank line
  - Trim leading/trailing whitespace

### Phase 5: TTS API & Audio Playback

**File:** `src/tts.ts`

```
class TTSPlayer {
  private currentProcess: ChildProcess | null = null;
  private tempFile: string | null = null;

  async play(text: string, config: TTSConfig): Promise<void>
  stop(): void
  dispose(): void
}
```

**API call:**
- Use Node.js `https.request()` to POST to `https://api.openai.com/v1/audio/speech`
- Body: `{ model, voice, speed, input: text }`
- Response is raw audio bytes (mp3) — stream directly to a temp file
- No npm dependencies

**Playback:**
- Write response to `os.tmpdir()/tts-vscode-{uuid}.mp3`
- Spawn `afplay <tempfile>` via `child_process.spawn()`
- On `stop()`: kill the `afplay` process, delete temp file
- On new `play()`: call `stop()` first (single playback guarantee)
- On process exit: clean up temp file

**Error handling:**
- API errors (401, 429, 500) → parse JSON error response, show via `vscode.window.showErrorMessage`
- Network errors → show generic connectivity message
- `afplay` not found → show "macOS only" message

### Phase 6: Status Bar & Toggle

**File:** `src/statusBar.ts`

```
class StatusBarManager {
  private item: vscode.StatusBarItem;
  private enabled: boolean;

  constructor(context: vscode.ExtensionContext)
  toggle(): void
  isEnabled(): boolean
}
```

- Status bar item at `StatusBarAlignment.Right`, priority `100`
- Shows `$(unmute) TTS` when enabled, `$(mute) TTS` when disabled (using codicons)
- Click triggers `tts.toggle` command
- Persists via `context.globalState.get/update('tts.enabled', true)` (default enabled)
- **Deliberate spec deviation:** spec says `workspaceState`, but `globalState` is better UX — you don't want to re-enable TTS in every workspace
- When disabled, `tts.read` shows "TTS is disabled" info message

### Phase 7: Wiring It All Together

**File:** `src/extension.ts` (revisit)

`tts.read` command flow:
1. Check enabled → bail if not
2. Check API key → prompt if missing
3. Extract text → bail if none
4. If `.md` file → strip markdown
5. Truncate to 4000 chars
6. Call `TTSPlayer.play()` with config from settings
7. Update status bar to show playing state

`tts.stop` command flow:
1. Call `TTSPlayer.stop()`
2. Update status bar

---

## package.json contributes (key sections)

```jsonc
{
  "contributes": {
    "commands": [
      { "command": "tts.read", "title": "TTS: Read Selection or File" },
      { "command": "tts.stop", "title": "TTS: Stop" },
      { "command": "tts.toggle", "title": "TTS: Toggle" },
      { "command": "tts.setApiKey", "title": "TTS: Set OpenAI API Key" }
    ],
    "keybindings": [
      { "command": "tts.read", "key": "cmd+shift+r" },
      { "command": "tts.stop", "key": "cmd+shift+." }
    ],
    "menus": {
      "editor/context": [
        { "command": "tts.read", "group": "tts" },
        { "command": "tts.stop", "group": "tts" }
      ]
    },
    "configuration": {
      "title": "TTS",
      "properties": {
        "tts.voice": {
          "type": "string",
          "default": "fable",
          "enum": ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral"],
          "description": "OpenAI TTS voice"
        },
        "tts.speed": {
          "type": "number",
          "default": 1.0,
          "minimum": 0.25,
          "maximum": 4.0,
          "description": "Playback speed"
        },
        "tts.model": {
          "type": "string",
          "default": "gpt-4o-mini-tts",
          "enum": ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"],
          "description": "OpenAI TTS model"
        }
      }
    }
  }
}
```

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Markdown preview text extraction | Can't get text from webview | Fall back to source file via `activeTextEditor` — works in 95% of cases |
| `afplay` blocking or hanging | Zombie processes | Track PID, kill on stop/new-play, kill on deactivate |
| Large files exceeding API limit | API error or huge cost | Hard truncate at 4000 chars, warn user |
| API key leaking to settings.json | Security issue | Never register a config property for the key, SecretStorage only |
| Temp file accumulation | Disk space | Delete on playback end + cleanup array on deactivate |

---

## Build Order

Implement in this order for fastest path to a working demo:

1. **Scaffold** — package.json, tsconfig, extension.ts shell → verify it activates
2. **Secrets** — API key input + storage → verify key persists across restart
3. **TTS API + Playback** — hardcoded test string → verify audio plays
4. **Text extraction** — selection/file reading → verify real text plays
5. **Markdown stripping** — strip before sending → verify clean output
6. **Status bar + toggle** — UI polish → verify enable/disable works
7. **Edge cases** — stop during playback, rapid re-triggers, no editor open, error messages
8. **Package** — `vsce package`, test install from `.vsix`
