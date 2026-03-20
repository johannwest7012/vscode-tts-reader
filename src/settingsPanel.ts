import * as vscode from 'vscode';
import { getApiKey } from './secrets';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'tts.settingsView';
    private view?: vscode.WebviewView;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };

        webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.updateWebview();
            }
        });

        this.updateWebview();
    }

    async refresh() {
        await this.updateWebview();
    }

    private async handleMessage(msg: { type: string; key?: string; voice?: string; speed?: number; model?: string }) {
        switch (msg.type) {
            case 'saveApiKey': {
                if (msg.key) {
                    await this.context.secrets.store('tts.openaiApiKey', msg.key);
                    vscode.window.showInformationMessage('OpenAI API key saved.');
                }
                await this.updateWebview();
                break;
            }
            case 'removeApiKey': {
                await this.context.secrets.delete('tts.openaiApiKey');
                vscode.window.showInformationMessage('OpenAI API key removed.');
                await this.updateWebview();
                break;
            }
            case 'updateSettings': {
                const config = vscode.workspace.getConfiguration('tts');
                if (msg.voice !== undefined) {
                    await config.update('voice', msg.voice, vscode.ConfigurationTarget.Global);
                }
                if (msg.speed !== undefined) {
                    await config.update('speed', msg.speed, vscode.ConfigurationTarget.Global);
                }
                if (msg.model !== undefined) {
                    await config.update('model', msg.model, vscode.ConfigurationTarget.Global);
                }
                break;
            }
        }
    }

    private async updateWebview() {
        if (!this.view) {
            return;
        }

        const apiKey = await getApiKey(this.context);
        const config = vscode.workspace.getConfiguration('tts');
        const voice = config.get<string>('voice', 'fable');
        const speed = config.get<number>('speed', 1.0);
        const model = config.get<string>('model', 'gpt-4o-mini-tts');

        this.view.webview.html = this.getHtml({
            hasApiKey: !!apiKey,
            apiKeyPreview: apiKey ? `sk-...${apiKey.slice(-4)}` : '',
            voice,
            speed,
            model,
        });
    }

    private getHtml(state: {
        hasApiKey: boolean;
        apiKeyPreview: string;
        voice: string;
        speed: number;
        model: string;
    }): string {
        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
        padding: 12px 14px;
        margin: 0;
    }
    .section {
        margin-bottom: 20px;
    }
    .section-title {
        font-size: 0.8em;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
    }
    label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
    }
    .description {
        font-size: 0.8em;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 6px;
    }
    select, input[type="text"], input[type="password"] {
        width: 100%;
        padding: 4px 6px;
        border: 1px solid var(--vscode-input-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border-radius: 2px;
        font-size: inherit;
        font-family: inherit;
        box-sizing: border-box;
    }
    select:focus, input:focus {
        outline: 1px solid var(--vscode-focusBorder);
        border-color: var(--vscode-focusBorder);
    }
    .field {
        margin-bottom: 12px;
    }
    .api-key-status {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
        padding: 6px 8px;
        border-radius: 3px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        font-size: 0.9em;
    }
    .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .dot-set { background: var(--vscode-charts-green); }
    .dot-unset { background: var(--vscode-charts-red); }
    .btn-row {
        display: flex;
        gap: 6px;
        margin-top: 6px;
    }
    button {
        padding: 4px 10px;
        border: none;
        border-radius: 2px;
        font-size: inherit;
        font-family: inherit;
        cursor: pointer;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
    }
    button:hover {
        background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
        background: var(--vscode-button-secondaryHoverBackground);
    }
    .key-input-row {
        display: flex;
        gap: 6px;
    }
    .key-input-row input {
        flex: 1;
    }
    .speed-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .speed-row input[type="range"] {
        flex: 1;
        accent-color: var(--vscode-button-background);
    }
    .speed-value {
        min-width: 32px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-size: 0.9em;
    }
</style>
</head>
<body>
    <div class="section">
        <div class="section-title">API Key</div>
        <div class="api-key-status">
            <span class="dot ${state.hasApiKey ? 'dot-set' : 'dot-unset'}"></span>
            <span>${state.hasApiKey ? `Configured (${state.apiKeyPreview})` : 'Not set'}</span>
        </div>
        <div class="key-input-row">
            <input type="password" id="apiKeyInput" placeholder="sk-..." />
            <button onclick="saveKey()">Save</button>
        </div>
        ${state.hasApiKey ? '<div class="btn-row"><button class="secondary" onclick="removeKey()">Remove</button></div>' : ''}
    </div>

    <div class="section">
        <div class="section-title">Voice</div>
        <div class="field">
            <div class="description">OpenAI TTS voice</div>
            <select id="voice" onchange="updateSettings()">
                ${['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer']
                    .map((v) => `<option value="${v}" ${v === state.voice ? 'selected' : ''}>${v}</option>`)
                    .join('\n')}
            </select>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Speed</div>
        <div class="field">
            <div class="description">0.25x (slow) to 4.0x (fast)</div>
            <div class="speed-row">
                <input type="range" id="speed" min="0.25" max="4.0" step="0.05" value="${state.speed}" oninput="onSpeedChange()" onchange="updateSettings()" />
                <span class="speed-value" id="speedDisplay">${state.speed.toFixed(2)}x</span>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Model</div>
        <div class="field">
            <div class="description">gpt-4o-mini-tts is latest, tts-1-hd is higher quality</div>
            <select id="model" onchange="updateSettings()">
                ${['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd']
                    .map((m) => `<option value="${m}" ${m === state.model ? 'selected' : ''}>${m}</option>`)
                    .join('\n')}
            </select>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function saveKey() {
            const input = document.getElementById('apiKeyInput');
            const key = input.value.trim();
            if (!key) return;
            vscode.postMessage({ type: 'saveApiKey', key });
            input.value = '';
        }

        function removeKey() {
            vscode.postMessage({ type: 'removeApiKey' });
        }

        function onSpeedChange() {
            const val = parseFloat(document.getElementById('speed').value);
            document.getElementById('speedDisplay').textContent = val.toFixed(2) + 'x';
        }

        function updateSettings() {
            vscode.postMessage({
                type: 'updateSettings',
                voice: document.getElementById('voice').value,
                speed: parseFloat(document.getElementById('speed').value),
                model: document.getElementById('model').value,
            });
        }

        document.getElementById('apiKeyInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveKey();
        });
    </script>
</body>
</html>`;
    }
}
