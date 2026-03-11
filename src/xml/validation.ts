import { Diagnostic, StructuralValidationResult, XmlToken } from '../types';

export function validateStructure(
    originalTokens: readonly XmlToken[],
    formattedTokens: readonly XmlToken[],
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

function computeStructureSignature(tokens: readonly XmlToken[]): string {
    const parts: string[] = [];
    for (const token of tokens) {
        switch (token.kind) {
            case 'openTag':
            case 'closeTag':
            case 'selfClosingTag':
                parts.push(`${token.kind}:${token.name}`);
                break;
            case 'text':
                // Formatting intentionally changes inter-tag whitespace, so text nodes are ignored
                // for structural validation to avoid false negatives on safe indentation changes.
                if (!token.isWhitespaceOnly) {
                    parts.push('text:nw');
                }
                break;
            case 'declaration':
            case 'doctype':
            case 'processingInstruction':
            case 'comment':
            case 'cdata':
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
