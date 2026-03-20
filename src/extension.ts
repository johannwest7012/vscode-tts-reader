import * as vscode from 'vscode';
import { TTSPlayer } from './tts';
import { getTextToRead } from './textExtractor';
import { stripMarkdown } from './markdownStripper';
import { StatusBarManager } from './statusBar';
import { ensureApiKey, setApiKey } from './secrets';

let player: TTSPlayer;
let statusBar: StatusBarManager;

export function activate(context: vscode.ExtensionContext) {
    player = new TTSPlayer();
    statusBar = new StatusBarManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('tts.read', () => handleRead(context)),
        vscode.commands.registerCommand('tts.stop', () => handleStop()),
        vscode.commands.registerCommand('tts.toggle', () => statusBar.toggle()),
        vscode.commands.registerCommand('tts.setApiKey', () => setApiKey(context)),
    );
}

async function handleRead(context: vscode.ExtensionContext) {
    if (!statusBar.isEnabled()) {
        vscode.window.showInformationMessage('TTS is disabled. Click the status bar item to enable.');
        return;
    }

    const apiKey = await ensureApiKey(context);
    if (!apiKey) {
        return;
    }

    const extracted = getTextToRead();
    if (!extracted) {
        return;
    }

    let text = extracted.text;
    if (extracted.languageId === 'markdown') {
        text = stripMarkdown(text);
    }

    const config = vscode.workspace.getConfiguration('tts');
    const model = config.get<string>('model', 'gpt-4o-mini-tts');
    const voice = config.get<string>('voice', 'fable');
    const speed = config.get<number>('speed', 1.0);

    statusBar.setPlaying(true);

    try {
        await player.play(text, { apiKey, model, voice, speed });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        vscode.window.showErrorMessage(`TTS: ${message}`);
    } finally {
        statusBar.setPlaying(false);
    }
}

function handleStop() {
    player.stop();
    statusBar.setPlaying(false);
}

export function deactivate() {
    player?.dispose();
}
