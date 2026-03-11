import { FormatOptions } from '../types';
import { JsonToken } from './types';

/** Tracks which currently open blocks were empty (so we close them on same line and do not decrement depth). */
type EmptyBlockKind = 'brace' | 'bracket';

export function formatJsonFromTokens(tokens: readonly JsonToken[], options: FormatOptions): string {
    const chunks: string[] = [];
    let depth = 0;
    let needIndent = true;
    let afterComma = false;
    /** Stack of empty-block kinds: when we open an empty {} or [], we push here; on matching close we pop and keep on one line. */
    const emptyBlockStack: EmptyBlockKind[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const next = tokens[i + 1] ?? null;

        if (needIndent && token.kind !== 'braceClose' && token.kind !== 'bracketClose') {
            chunks.push(repeatIndent(options.indentUnit, depth));
            needIndent = false;
        }

        switch (token.kind) {
            case 'braceOpen': {
                const empty = isEmptyBlock(tokens, i, 'brace');
                chunks.push('{');
                depth += 1;
                if (empty) {
                    emptyBlockStack.push('brace');
                    depth -= 1;
                } else {
                    chunks.push('\n');
                }
                needIndent = !empty;
                break;
            }
            case 'braceClose': {
                const isClosingEmptyBlock =
                    emptyBlockStack.length > 0 &&
                    emptyBlockStack[emptyBlockStack.length - 1] === 'brace';
                if (isClosingEmptyBlock) {
                    emptyBlockStack.pop();
                    chunks.push('}');
                    // depth was not incremented for this empty block, so do not decrement
                } else {
                    depth = Math.max(0, depth - 1);
                    const lastChunk = chunks[chunks.length - 1];
                    if (afterComma || lastChunk !== '\n') {
                        chunks.push('\n');
                    }
                    chunks.push(repeatIndent(options.indentUnit, depth));
                    chunks.push('}');
                }
                needIndent = false;
                break;
            }
            case 'bracketOpen': {
                const empty = isEmptyBlock(tokens, i, 'bracket');
                chunks.push('[');
                depth += 1;
                if (empty) {
                    emptyBlockStack.push('bracket');
                    depth -= 1;
                } else {
                    chunks.push('\n');
                }
                needIndent = !empty;
                break;
            }
            case 'bracketClose': {
                const isClosingEmptyBlock =
                    emptyBlockStack.length > 0 &&
                    emptyBlockStack[emptyBlockStack.length - 1] === 'bracket';
                if (isClosingEmptyBlock) {
                    emptyBlockStack.pop();
                    chunks.push(']');
                    // depth was not incremented for this empty block, so do not decrement
                } else {
                    depth = Math.max(0, depth - 1);
                    const lastChunk = chunks[chunks.length - 1];
                    if (afterComma || lastChunk !== '\n') {
                        chunks.push('\n');
                    }
                    chunks.push(repeatIndent(options.indentUnit, depth));
                    chunks.push(']');
                }
                needIndent = false;
                break;
            }
            case 'comma':
                chunks.push(',');
                chunks.push('\n');
                needIndent = true;
                afterComma = true;
                break;
            case 'colon':
                chunks.push(': ');
                afterComma = false;
                break;
            case 'string':
            case 'number':
            case 'literal':
                chunks.push(token.raw);
                afterComma = false;
                needIndent = false;
                if (
                    next?.kind === 'comma' ||
                    next?.kind === 'braceClose' ||
                    next?.kind === 'bracketClose'
                ) {
                    // next token will handle newline
                }
                break;
            default:
                break;
        }
    }

    const formatted = chunks.join('');
    if (options.insertFinalNewline && !formatted.endsWith('\n')) {
        return `${formatted}\n`;
    }
    return formatted;
}

/**
 * Returns true if the block opened at openIndex is immediately closed (no content).
 * Used to keep empty {} and [] on one line and to avoid decrementing depth on their close.
 */
function isEmptyBlock(
    tokens: readonly JsonToken[],
    openIndex: number,
    type: 'brace' | 'bracket',
): boolean {
    const nextIndex = openIndex + 1;
    if (nextIndex >= tokens.length) {
        return false;
    }
    const closeKind = type === 'brace' ? 'braceClose' : 'bracketClose';
    return tokens[nextIndex].kind === closeKind;
}

function repeatIndent(indentUnit: string, depth: number): string {
    return indentUnit.repeat(depth);
}
