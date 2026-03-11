import { FormatOptions, FormatResult } from '../types';
import { formatXmlFromTokens } from './formatter';
import { tokenizeXml } from './tokenizer';
import { validateStructure } from './validation';

export function formatXml(text: string, options: FormatOptions): FormatResult {
    const start = performance.now();
    const tokenized = tokenizeXml(text);
    const candidate = formatXmlFromTokens(tokenized.tokens, options);
    const candidateTokenized = tokenizeXml(candidate);
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
