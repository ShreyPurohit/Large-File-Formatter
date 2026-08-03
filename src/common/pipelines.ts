import { FormatLanguage, FormatOptions, FormatResult } from '../types';
import { formatHtml } from '../html/pipeline';
import { formatJson } from '../json/pipeline';
import { formatXml } from '../xml/pipeline';

/** Display labels for status messages. */
export const LANGUAGE_LABELS: Record<FormatLanguage, string> = {
    xml: 'XML',
    json: 'JSON',
    html: 'HTML',
};

/** VS Code setting keys for per-language worker thresholds. */
export const WORKER_THRESHOLD_CONFIG_KEYS: Record<FormatLanguage, string> = {
    xml: 'workerThresholdBytes',
    json: 'jsonWorkerThresholdBytes',
    html: 'htmlWorkerThresholdBytes',
};

/**
 * Dispatches to the language-specific format pipeline.
 * Used by both the extension host and the worker thread.
 */
export function formatDocument(
    language: FormatLanguage,
    text: string,
    options: FormatOptions,
): FormatResult {
    switch (language) {
        case 'xml':
            return formatXml(text, options);
        case 'json':
            return formatJson(text, options);
        case 'html':
            return formatHtml(text, options);
        default:
            return assertNever(language);
    }
}

function assertNever(value: never): never {
    throw new Error(`Unsupported format language: ${JSON.stringify(value)}`);
}
