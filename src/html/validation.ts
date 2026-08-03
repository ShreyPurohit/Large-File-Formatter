import { Diagnostic, StructuralValidationResult } from '../types';
import { HtmlToken } from './types';

export function validateStructure(
    originalTokens: readonly HtmlToken[],
    formattedTokens: readonly HtmlToken[],
): StructuralValidationResult {
    const originalSignature = computeStructureSignature(originalTokens);
    const formattedSignature = computeStructureSignature(formattedTokens);

    if (originalSignature === formattedSignature) {
        return { isValid: true, diagnostics: [] };
    }

    const diagnostics: Diagnostic[] = [
        {
            severity: 'warning',
            message: 'Formatted output failed structure validation; using fallback output.',
            start: 0,
            end: 0,
        },
    ];
    return { isValid: false, diagnostics };
}

function computeStructureSignature(tokens: readonly HtmlToken[]): string {
    const parts: string[] = [];
    for (const token of tokens) {
        switch (token.kind) {
            case 'openTag':
            case 'closeTag':
            case 'selfClosingTag':
                // Names are already lowercased by the tokenizer.
                parts.push(`${token.kind}:${token.name}`);
                break;
            case 'text':
                // Formatting changes inter-tag whitespace; ignore whitespace-only text.
                if (!token.isWhitespaceOnly) {
                    parts.push('text:nw');
                }
                break;
            case 'doctype':
            case 'comment':
                parts.push(token.kind);
                break;
            default:
                assertNever(token);
        }
    }
    return parts.join('|');
}

function assertNever(value: never): never {
    throw new Error(`Unexpected token in validation: ${JSON.stringify(value)}`);
}
