import * as vscode from 'vscode';
import * as path from 'path';
import { Worker } from 'node:worker_threads';
import { buildMinimalTextEdits } from './common/edits';
import { formatJson } from './json/pipeline';
import { formatXml } from './xml/pipeline';
import { FormatLanguage, FormatOptions, WorkerFormatRequest, WorkerFormatResponse } from './types';

interface FormatExecutionResult {
    readonly formattedText: string;
    readonly workerAttempted: boolean;
    readonly workerUsed: boolean;
    readonly fallbackUsed: boolean;
    readonly tokenCount: number;
}

export function activate(context: vscode.ExtensionContext) {
    const workerClient = new FormatWorkerClient(
        context.asAbsolutePath(path.join('dist', 'worker', 'formatWorker.js')),
    );
    context.subscriptions.push(workerClient);

    const xmlProvider = vscode.languages.registerDocumentFormattingEditProvider(
        'xml',
        createFormatProvider('xml', workerClient),
    );
    context.subscriptions.push(xmlProvider);

    const jsonProvider = vscode.languages.registerDocumentFormattingEditProvider(
        'json',
        createFormatProvider('json', workerClient),
    );
    context.subscriptions.push(jsonProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('large-file-formatter.formatCurrentDocument', async () => {
            await vscode.commands.executeCommand('editor.action.formatDocument');
        }),
    );
}

function createFormatProvider(
    language: FormatLanguage,
    workerClient: FormatWorkerClient,
): vscode.DocumentFormattingEditProvider {
    const label = language === 'xml' ? 'XML' : 'JSON';
    return {
        provideDocumentFormattingEdits: async (document, options, token) => {
            const startedAt = performance.now();
            if (token.isCancellationRequested) {
                return [];
            }

            const text = document.getText();
            const inputBytes = Buffer.byteLength(text, 'utf8');
            const formatOptions = toFormatOptions(language, options);
            const execution = await executeFormatting(language, text, formatOptions, workerClient);

            if (token.isCancellationRequested) {
                return [];
            }

            const edits = buildMinimalTextEdits(text, execution.formattedText);
            const elapsedMs = performance.now() - startedAt;
            const showFormatTiming = vscode.workspace
                .getConfiguration('large-file-formatter')
                .get<boolean>('showFormatTiming', true);
            const showFormatDetails = vscode.workspace
                .getConfiguration('large-file-formatter')
                .get<boolean>('showFormatDetails', true);

            if (showFormatTiming) {
                const message = showFormatDetails
                    ? [
                          `File Size: ${formatBytes(inputBytes)}`,
                          `Tokens: ${execution.tokenCount.toLocaleString()}`,
                          `Formatting Time: ${Math.round(elapsedMs)} ms`,
                          `Worker Thread: ${execution.workerUsed ? 'enabled' : execution.workerAttempted ? 'fallback' : 'disabled'}`,
                          `Memory Mode: ${execution.workerUsed ? 'large-file' : 'inline'}`,
                      ].join(' | ')
                    : `${label} formatted in ${elapsedMs.toFixed(1)} ms`;
                void vscode.window.showInformationMessage(message);
            }
            return edits.map((edit) =>
                vscode.TextEdit.replace(
                    new vscode.Range(
                        document.positionAt(edit.start),
                        document.positionAt(edit.end),
                    ),
                    edit.newText,
                ),
            );
        },
    };
}

export function deactivate() {
    // no-op: disposables are handled by extension context
}

let requestCounter = 0;

function createRequestId(): string {
    requestCounter += 1;
    return `format-${Date.now()}-${requestCounter}`;
}

function toFormatOptions(
    language: FormatLanguage,
    options: vscode.FormattingOptions,
): FormatOptions {
    const tabSize = Number.isFinite(options.tabSize) ? Math.max(1, Math.floor(options.tabSize)) : 2;
    const indentUnit = options.insertSpaces ? ' '.repeat(tabSize) : '\t';
    const config = vscode.workspace.getConfiguration('large-file-formatter');
    const insertFinalNewline = config.get<boolean>('insertFinalNewline', true);
    const thresholdKey = language === 'xml' ? 'workerThresholdBytes' : 'jsonWorkerThresholdBytes';
    const workerThresholdBytes = Math.max(1024, config.get<number>(thresholdKey, 128 * 1024));

    return {
        indentUnit,
        insertFinalNewline,
        useWorkerThresholdBytes: workerThresholdBytes,
    };
}

async function executeFormatting(
    language: FormatLanguage,
    text: string,
    formatOptions: FormatOptions,
    workerClient: FormatWorkerClient,
): Promise<FormatExecutionResult> {
    const shouldUseWorker =
        Buffer.byteLength(text, 'utf8') >= formatOptions.useWorkerThresholdBytes;
    if (!shouldUseWorker) {
        const direct =
            language === 'xml' ? formatXml(text, formatOptions) : formatJson(text, formatOptions);
        return {
            formattedText: direct.formattedText,
            workerAttempted: false,
            workerUsed: false,
            fallbackUsed: direct.stats.usedFallback,
            tokenCount: direct.stats.tokenCount,
        };
    }

    const workerResponse = await workerClient.format({
        requestId: createRequestId(),
        language,
        text,
        options: formatOptions,
    });
    if (workerResponse.ok) {
        return {
            formattedText: workerResponse.result.formattedText,
            workerAttempted: true,
            workerUsed: true,
            fallbackUsed: workerResponse.result.stats.usedFallback,
            tokenCount: workerResponse.result.stats.tokenCount,
        };
    }

    console.warn(`Format worker failed (${language}): ${workerResponse.message}`);
    const fallback =
        language === 'xml' ? formatXml(text, formatOptions) : formatJson(text, formatOptions);
    return {
        formattedText: fallback.formattedText,
        workerAttempted: true,
        workerUsed: false,
        fallbackUsed: true,
        tokenCount: fallback.stats.tokenCount,
    };
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

class FormatWorkerClient implements vscode.Disposable {
    private readonly workerPath: string;
    private readonly pending = new Map<
        string,
        {
            resolve: (value: WorkerFormatResponse) => void;
            reject: (reason?: unknown) => void;
        }
    >();
    private worker: Worker | null = null;

    public constructor(workerPath: string) {
        this.workerPath = workerPath;
    }

    public async format(request: WorkerFormatRequest): Promise<WorkerFormatResponse> {
        const worker = this.ensureWorker();
        return new Promise<WorkerFormatResponse>((resolve, reject) => {
            this.pending.set(request.requestId, { resolve, reject });
            worker.postMessage(request);
        });
    }

    public dispose(): void {
        for (const pending of this.pending.values()) {
            pending.reject(new Error('Worker disposed before response.'));
        }
        this.pending.clear();
        if (this.worker !== null) {
            void this.worker.terminate();
            this.worker = null;
        }
    }

    private ensureWorker(): Worker {
        if (this.worker !== null) {
            return this.worker;
        }

        const worker = new Worker(this.workerPath);
        worker.on('message', (response: WorkerFormatResponse) => {
            const entry = this.pending.get(response.requestId);
            if (!entry) {
                return;
            }
            this.pending.delete(response.requestId);
            entry.resolve(response);
        });
        worker.on('error', (error: Error) => {
            this.rejectAllPending(error);
            this.worker = null;
        });
        worker.on('exit', (code: number) => {
            if (code !== 0) {
                this.rejectAllPending(new Error(`Format worker exited with code ${code}.`));
            }
            this.worker = null;
        });

        this.worker = worker;
        return worker;
    }

    private rejectAllPending(reason: unknown): void {
        for (const pending of this.pending.values()) {
            pending.reject(reason);
        }
        this.pending.clear();
    }
}
