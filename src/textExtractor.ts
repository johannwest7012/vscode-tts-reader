import * as vscode from 'vscode';

const MAX_CHARS = 4000;

interface ExtractedText {
    text: string;
    languageId: string;
}

function findMarkdownDocument(): vscode.TextDocument | undefined {
    // Check visible editors first (side-by-side preview)
    const visibleMd = vscode.window.visibleTextEditors.find(
        (e) => e.document.languageId === 'markdown'
    );
    if (visibleMd) {
        return visibleMd.document;
    }

    // Fall back to any open markdown document (preview without editor visible)
    return vscode.workspace.textDocuments.find(
        (d) => d.languageId === 'markdown' && d.uri.scheme === 'file'
    );
}

export function getTextToRead(): ExtractedText | undefined {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        const selection = editor.selection;
        let text: string;

        if (!selection.isEmpty) {
            text = editor.document.getText(selection);
        } else {
            text = editor.document.getText();
        }

        return truncate(text, editor.document.languageId);
    }

    // No active editor — likely in markdown preview. Find the source document.
    const mdDoc = findMarkdownDocument();
    if (mdDoc) {
        return truncate(mdDoc.getText(), mdDoc.languageId);
    }

    vscode.window.showWarningMessage('TTS: No active editor. Open a file to read.');
    return undefined;
}

function truncate(text: string, languageId: string): ExtractedText | undefined {
    if (!text.trim()) {
        vscode.window.showWarningMessage('TTS: No text to read.');
        return undefined;
    }

    if (text.length > MAX_CHARS) {
        text = text.substring(0, MAX_CHARS);
        vscode.window.showInformationMessage(`TTS: Text truncated to ${MAX_CHARS} characters.`);
    }

    return { text, languageId };
}
