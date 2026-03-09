import * as vscode from 'vscode';
import * as path from 'path';
import { Worker } from 'node:worker_threads';
import { buildMinimalTextEdits } from './xml/edits';
import { formatXml } from './xml/pipeline';
import { WorkerFormatRequest, WorkerFormatResponse, XmlFormatOptions } from './types';

interface FormatExecutionResult {
    readonly formattedText: string;
    readonly workerAttempted: boolean;
    readonly workerUsed: boolean;
    readonly fallbackUsed: boolean;
    readonly tokenCount: number;
}

export function activate(context: vscode.ExtensionContext) {
    const workerClient = new XmlFormatWorkerClient(
        context.asAbsolutePath(path.join('dist', 'worker', 'formatWorker.js')),
    );
    context.subscriptions.push(workerClient);

    const provider = vscode.languages.registerDocumentFormattingEditProvider('xml', {
        provideDocumentFormattingEdits: async (document, options, token) => {
            const startedAt = performance.now();
            if (token.isCancellationRequested) {
                return [];
            }

            const text = document.getText();
            const inputBytes = Buffer.byteLength(text, 'utf8');
            const formatOptions = toXmlFormatOptions(options);
            const execution = await executeFormatting(text, formatOptions, workerClient);

            if (token.isCancellationRequested) {
                return [];
            }

            const edits = buildMinimalTextEdits(text, execution.formattedText);
            const elapsedMs = performance.now() - startedAt;
            const showFormatTiming = vscode.workspace
                .getConfiguration('large-xml-formatter')
                .get<boolean>('showFormatTiming', true);
            const showFormatDetails = vscode.workspace
                .getConfiguration('large-xml-formatter')
                .get<boolean>('showFormatDetails', true);
            if (showFormatTiming) {
                const details = showFormatDetails
                    ? [
                          `Worker: ${execution.workerUsed ? 'yes' : execution.workerAttempted ? 'attempted, fallback used' : 'no'}`,
                          `Fallback: ${execution.fallbackUsed ? 'yes' : 'no'}`,
                          `Size: ${formatBytes(inputBytes)}`,
                          `Threshold: ${formatBytes(formatOptions.useWorkerThresholdBytes)}`,
                          `Edits: ${edits.length}`,
                          `Tokens: ${execution.tokenCount.toLocaleString()}`,
                      ].join(' | ')
                    : '';
                const message = details
                    ? `XML formatted in ${elapsedMs.toFixed(1)} ms | ${details}`
                    : `XML formatted in ${elapsedMs.toFixed(1)} ms`;
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
    });

    context.subscriptions.push(provider);

    context.subscriptions.push(
        vscode.commands.registerCommand('large-xml-formatter.formatXmlDocument', async () => {
            await vscode.commands.executeCommand('editor.action.formatDocument');
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('large-xml-formatter.benchmarkCurrentXml', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'xml') {
                void vscode.window.showWarningMessage(
                    'Open an XML file to benchmark formatter performance.',
                );
                return;
            }

            const options = toXmlFormatOptions({
                insertSpaces: true,
                tabSize: 2,
            });
            const text = editor.document.getText();
            const start = performance.now();
            const result = formatXml(text, options);
            const durationMs = performance.now() - start;

            void vscode.window.showInformationMessage(
                `Formatted ${result.stats.tokenCount.toLocaleString()} tokens in ${durationMs.toFixed(1)} ms.`,
            );
        }),
    );
}

export function deactivate() {
    // no-op: disposables are handled by extension context
}

let requestCounter = 0;

function createRequestId(): string {
    requestCounter += 1;
    return `xml-format-${Date.now()}-${requestCounter}`;
}

function toXmlFormatOptions(options: vscode.FormattingOptions): XmlFormatOptions {
    const tabSize = Number.isFinite(options.tabSize) ? Math.max(1, Math.floor(options.tabSize)) : 2;
    const indentUnit = options.insertSpaces ? ' '.repeat(tabSize) : '\t';
    const config = vscode.workspace.getConfiguration('large-xml-formatter');
    const insertFinalNewline = config.get<boolean>('insertFinalNewline', true);
    const workerThresholdBytes = Math.max(
        1024,
        config.get<number>('workerThresholdBytes', 128 * 1024),
    );

    return {
        indentUnit,
        insertFinalNewline,
        useWorkerThresholdBytes: workerThresholdBytes,
    };
}

async function executeFormatting(
    text: string,
    formatOptions: XmlFormatOptions,
    workerClient: XmlFormatWorkerClient,
): Promise<FormatExecutionResult> {
    const shouldUseWorker =
        Buffer.byteLength(text, 'utf8') >= formatOptions.useWorkerThresholdBytes;
    if (!shouldUseWorker) {
        const direct = formatXml(text, formatOptions);
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

    console.warn(`XML worker formatting failed: ${workerResponse.message}`);
    const fallback = formatXml(text, formatOptions);
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

class XmlFormatWorkerClient implements vscode.Disposable {
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
                this.rejectAllPending(new Error(`XML formatter worker exited with code ${code}.`));
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
