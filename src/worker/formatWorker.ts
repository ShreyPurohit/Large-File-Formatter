import { parentPort } from 'node:worker_threads';
import {
    WorkerFormatFailure,
    WorkerFormatRequest,
    WorkerFormatResponse,
    WorkerFormatSuccess,
} from '../types';
import { buildMinimalTextEdits } from '../common/edits';
import { formatDocument } from '../common/pipelines';

if (parentPort === null) {
    throw new Error('Format worker started without parent port.');
}

parentPort.on('message', (request: WorkerFormatRequest) => {
    try {
        const result = formatDocument(request.language, request.text, request.options);
        const edits = buildMinimalTextEdits(request.text, result.formattedText);
        const response: WorkerFormatSuccess = {
            requestId: request.requestId,
            ok: true,
            result,
            edits,
        };
        parentPort?.postMessage(response satisfies WorkerFormatResponse);
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'Unknown worker formatting failure.';
        const response: WorkerFormatFailure = {
            requestId: request.requestId,
            ok: false,
            message,
        };
        parentPort?.postMessage(response satisfies WorkerFormatResponse);
    }
});
