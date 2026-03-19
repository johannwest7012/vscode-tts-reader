import * as vscode from 'vscode';

const STATE_KEY = 'tts.enabled';

export class StatusBarManager {
    private item: vscode.StatusBarItem;
    private enabled: boolean;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.enabled = context.globalState.get<boolean>(STATE_KEY, true);

        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = 'tts.toggle';
        this.updateDisplay();
        this.item.show();

        context.subscriptions.push(this.item);
    }

    toggle(): void {
        this.enabled = !this.enabled;
        this.context.globalState.update(STATE_KEY, this.enabled);
        this.updateDisplay();

        const state = this.enabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`TTS ${state}.`);
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setPlaying(playing: boolean): void {
        this.updateDisplay(playing);
    }

    private updateDisplay(playing = false): void {
        if (!this.enabled) {
            this.item.text = '$(mute) TTS';
            this.item.tooltip = 'TTS: Disabled (click to enable)';
        } else if (playing) {
            this.item.text = '$(play) TTS';
            this.item.tooltip = 'TTS: Playing...';
        } else {
            this.item.text = '$(unmute) TTS';
            this.item.tooltip = 'TTS: Enabled (click to disable)';
        }
    }
}
