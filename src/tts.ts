import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import * as crypto from 'crypto';

export interface TTSConfig {
    apiKey: string;
    model: string;
    voice: string;
    speed: number;
}

export class TTSPlayer {
    private currentProcess: ChildProcess | null = null;
    private tempFile: string | null = null;
    private isPlaying = false;

    async play(text: string, config: TTSConfig): Promise<void> {
        // Kill any current playback
        this.stop();

        const tempFile = path.join(os.tmpdir(), `tts-vscode-${crypto.randomUUID()}.mp3`);
        this.tempFile = tempFile;

        try {
            await this.callApi(text, config, tempFile);
            await this.playFile(tempFile);
        } catch (err: unknown) {
            this.cleanup();
            if (err instanceof Error && err.message !== 'stopped') {
                throw err;
            }
        }
    }

    stop(): void {
        if (this.currentProcess) {
            this.currentProcess.kill();
            this.currentProcess = null;
        }
        this.cleanup();
        this.isPlaying = false;
    }

    dispose(): void {
        this.stop();
    }

    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    private callApi(text: string, config: TTSConfig, outFile: string): Promise<void> {
        return new Promise((resolve, reject) => {
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
                (res) => {
                    if (res.statusCode && res.statusCode >= 400) {
                        let errorBody = '';
                        res.on('data', (chunk) => (errorBody += chunk));
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

            req.on('error', (err) => {
                reject(new Error(`Network error: ${err.message}`));
            });

            req.write(body);
            req.end();
        });
    }

    private playFile(filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.isPlaying = true;
            const proc = spawn('afplay', [filePath]);
            this.currentProcess = proc;

            proc.on('close', (code) => {
                this.currentProcess = null;
                this.isPlaying = false;
                this.cleanup();
                if (code === 0 || code === null) {
                    resolve();
                } else {
                    // code 9 = killed (our stop()), not an error
                    resolve();
                }
            });

            proc.on('error', (err) => {
                this.currentProcess = null;
                this.isPlaying = false;
                this.cleanup();
                if (err.message.includes('ENOENT')) {
                    reject(new Error('afplay not found. This extension currently supports macOS only.'));
                } else {
                    reject(err);
                }
            });
        });
    }

    private cleanup(): void {
        if (this.tempFile) {
            try {
                fs.unlinkSync(this.tempFile);
            } catch {
                // File may already be deleted
            }
            this.tempFile = null;
        }
    }
}
