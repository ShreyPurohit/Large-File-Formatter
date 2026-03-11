import { Diagnostic } from '../types';
import { JsonToken } from './types';

export interface JsonStructuralValidationResult {
    readonly isValid: boolean;
    readonly diagnostics: Diagnostic[];
}

export function validateStructure(
    originalTokens: readonly JsonToken[],
    formattedTokens: readonly JsonToken[],
): JsonStructuralValidationResult {
    const originalSig = computeStructureSignature(originalTokens);
    const formattedSig = computeStructureSignature(formattedTokens);

    if (originalSig === formattedSig) {
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

function computeStructureSignature(tokens: readonly JsonToken[]): string {
    return tokens.map((t) => t.kind).join('|');
}
