import * as vscode from 'vscode';

const MAX_CHARS = 4000;

export function getTextToRead(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('TTS: No active editor. Open a file to read.');
        return undefined;
    }

    const selection = editor.selection;
    let text: string;

    if (!selection.isEmpty) {
        text = editor.document.getText(selection);
    } else {
        text = editor.document.getText();
    }

    if (!text.trim()) {
        vscode.window.showWarningMessage('TTS: No text to read.');
        return undefined;
    }

    if (text.length > MAX_CHARS) {
        text = text.substring(0, MAX_CHARS);
        vscode.window.showInformationMessage(`TTS: Text truncated to ${MAX_CHARS} characters.`);
    }

    return text;
}

export function isMarkdownFile(): boolean {
    const editor = vscode.window.activeTextEditor;
    return editor?.document.languageId === 'markdown';
}
