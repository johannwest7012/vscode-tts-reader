import * as vscode from 'vscode';

const SECRET_KEY = 'tts.openaiApiKey';

export async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    return context.secrets.get(SECRET_KEY);
}

export async function setApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    const key = await vscode.window.showInputBox({
        prompt: 'Enter your OpenAI API key',
        password: true,
        placeHolder: 'sk-...',
        ignoreFocusOut: true,
    });

    if (key) {
        await context.secrets.store(SECRET_KEY, key);
        vscode.window.showInformationMessage('OpenAI API key saved.');
    }

    return key;
}

export async function ensureApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    const existing = await getApiKey(context);
    if (existing) {
        return existing;
    }

    vscode.window.showInformationMessage('No OpenAI API key set. Please enter one now.');
    return setApiKey(context);
}
