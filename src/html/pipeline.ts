import { FormatOptions, FormatResult } from '../types';
import { formatHtmlFromTokens } from './formatter';
import { tokenizeHtml } from './tokenizer';
import { validateStructure } from './validation';

export function formatHtml(text: string, options: FormatOptions): FormatResult {
    const start = performance.now();
    const tokenized = tokenizeHtml(text);
    const candidate = formatHtmlFromTokens(tokenized.tokens, options);
    const candidateTokenized = tokenizeHtml(candidate);
    const validation = validateStructure(tokenized.tokens, candidateTokenized.tokens);

    const usedFallback = !validation.isValid;
    const formattedText = usedFallback ? text : candidate;
    const diagnostics = [
        ...tokenized.diagnostics,
        ...candidateTokenized.diagnostics,
        ...validation.diagnostics,
    ];
    const durationMs = performance.now() - start;

    return {
        formattedText,
        diagnostics,
        stats: {
            tokenCount: tokenized.tokens.length,
            durationMs,
            usedFallback,
        },
    };
}
