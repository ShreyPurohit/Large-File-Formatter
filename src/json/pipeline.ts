import { FormatOptions, FormatResult } from '../types';
import { formatJsonFromTokens } from './formatter';
import { tokenizeJson } from './tokenizer';
import { validateStructure } from './validation';

export function formatJson(text: string, options: FormatOptions): FormatResult {
    const start = performance.now();
    const tokenized = tokenizeJson(text);
    const candidate = formatJsonFromTokens(tokenized.tokens, options);
    const candidateTokenized = tokenizeJson(candidate);
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
