import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as crypto from 'crypto';
import { IncomingMessage } from 'http';

export interface TTSConfig {
    apiKey: string;
    model: string;
    voice: string;
    speed: number;
}

const CHUNK_SIZE = 600;

export class TTSPlayer {
    private currentProcess: ChildProcess | null = null;
    private tempFiles: string[] = [];
    private stopped = false;
    private isPlaying = false;

    async play(text: string, config: TTSConfig): Promise<void> {
        this.stop();
        this.stopped = false;
        this.isPlaying = true;

        const chunks = splitIntoChunks(text, CHUNK_SIZE);

        try {
            // Fetch first chunk, start playing immediately
            let nextFetch: Promise<string> | null = null;

            for (let i = 0; i < chunks.length; i++) {
                if (this.stopped) { break; }

                // Current chunk: use prefetched file or fetch now
                const currentFile = nextFetch
                    ? await nextFetch
                    : await this.fetchChunk(chunks[i], config);

                if (this.stopped) {
                    this.deleteTempFile(currentFile);
                    break;
                }

                // Start prefetching next chunk while current one plays
                nextFetch = (i + 1 < chunks.length && !this.stopped)
                    ? this.fetchChunk(chunks[i + 1], config)
                    : null;

                // Play current chunk
                await this.playFile(currentFile);
                this.deleteTempFile(currentFile);
            }
        } catch (err: unknown) {
            if (this.stopped) { return; }
            this.cleanupAll();
            if (err instanceof Error) {
                throw err;
            }
        } finally {
            this.isPlaying = false;
            this.cleanupAll();
        }
    }

    stop(): void {
        this.stopped = true;
        if (this.currentProcess) {
            this.currentProcess.kill();
            this.currentProcess = null;
        }
        this.cleanupAll();
        this.isPlaying = false;
    }

    dispose(): void {
        this.stop();
    }

    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    private async fetchChunk(text: string, config: TTSConfig): Promise<string> {
        const tempFile = path.join(os.tmpdir(), `tts-vscode-${crypto.randomUUID()}.mp3`);
        this.tempFiles.push(tempFile);
        await this.callApi(text, config, tempFile);
        return tempFile;
    }

    private callApi(text: string, config: TTSConfig, outFile: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.stopped) { reject(new Error('stopped')); return; }

            const body = JSON.stringify({
                model: config.model,
                voice: config.voice,
                speed: config.speed,
                input: text,
            });

            const req = https.request(
                {
                    hostname: 'api.openai.com',
                    path: '/v1/audio/speech',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body),
                    },
                },
                (res: IncomingMessage) => {
                    if (res.statusCode && res.statusCode >= 400) {
                        let errorBody = '';
                        res.on('data', (chunk: Buffer) => (errorBody += chunk));
                        res.on('end', () => {
                            try {
                                const parsed = JSON.parse(errorBody);
                                reject(new Error(parsed.error?.message || `API error ${res.statusCode}`));
                            } catch {
                                reject(new Error(`API error ${res.statusCode}: ${errorBody}`));
                            }
                        });
                        return;
                    }

                    const fileStream = fs.createWriteStream(outFile);
                    res.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close();
                        resolve();
                    });
                    fileStream.on('error', reject);
                }
            );

            req.on('error', (err: Error) => {
                reject(new Error(`Network error: ${err.message}`));
            });

            req.write(body);
            req.end();
        });
    }

    private playFile(filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.stopped) { resolve(); return; }

            const proc = spawn('afplay', [filePath]);
            this.currentProcess = proc;

            proc.on('close', () => {
                this.currentProcess = null;
                resolve();
            });

            proc.on('error', (err: Error) => {
                this.currentProcess = null;
                if (err.message.includes('ENOENT')) {
                    reject(new Error('afplay not found. This extension currently supports macOS only.'));
                } else {
                    reject(err);
                }
            });
        });
    }

    private deleteTempFile(filePath: string): void {
        try { fs.unlinkSync(filePath); } catch { /* already gone */ }
        this.tempFiles = this.tempFiles.filter((f) => f !== filePath);
    }

    private cleanupAll(): void {
        for (const f of this.tempFiles) {
            try { fs.unlinkSync(f); } catch { /* already gone */ }
        }
        this.tempFiles = [];
    }
}

function splitIntoChunks(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) {
        return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            chunks.push(remaining);
            break;
        }

        // Find the last sentence boundary within maxLen
        let splitAt = -1;
        const searchRegion = remaining.substring(0, maxLen);

        // Prefer splitting at sentence endings (.!?) followed by space
        for (let i = searchRegion.length - 1; i >= maxLen * 0.4; i--) {
            if (/[.!?]/.test(searchRegion[i]) && (i + 1 >= searchRegion.length || /\s/.test(searchRegion[i + 1]))) {
                splitAt = i + 1;
                break;
            }
        }

        // Fall back to newline
        if (splitAt === -1) {
            const lastNewline = searchRegion.lastIndexOf('\n');
            if (lastNewline > maxLen * 0.4) {
                splitAt = lastNewline + 1;
            }
        }

        // Fall back to last space
        if (splitAt === -1) {
            const lastSpace = searchRegion.lastIndexOf(' ');
            if (lastSpace > maxLen * 0.3) {
                splitAt = lastSpace + 1;
            }
        }

        // Hard cut as last resort
        if (splitAt === -1) {
            splitAt = maxLen;
        }

        chunks.push(remaining.substring(0, splitAt).trim());
        remaining = remaining.substring(splitAt).trim();
    }

    return chunks.filter((c) => c.length > 0);
}
