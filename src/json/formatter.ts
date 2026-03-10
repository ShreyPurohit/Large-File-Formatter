import { FormatOptions } from '../types';
import { JsonToken } from './types';

export function formatJsonFromTokens(tokens: readonly JsonToken[], options: FormatOptions): string {
    const chunks: string[] = [];
    let depth = 0;
    let needIndent = true;
    let afterComma = false;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const next = tokens[i + 1] ?? null;

        if (needIndent && token.kind !== 'braceClose' && token.kind !== 'bracketClose') {
            chunks.push(repeatIndent(options.indentUnit, depth));
            needIndent = false;
        }

        switch (token.kind) {
            case 'braceOpen':
                chunks.push('{');
                depth += 1;
                needIndent = !isEmptyBlock(tokens, i, 'brace');
                if (!needIndent) {
                    depth -= 1;
                } else {
                    chunks.push('\n');
                }
                break;
            case 'braceClose':
                if (afterComma || chunks[chunks.length - 1] !== '\n') {
                    chunks.push('\n');
                }
                depth = Math.max(0, depth - 1);
                chunks.push(repeatIndent(options.indentUnit, depth));
                chunks.push('}');
                needIndent = false;
                break;
            case 'bracketOpen':
                chunks.push('[');
                depth += 1;
                needIndent = !isEmptyBlock(tokens, i, 'bracket');
                if (!needIndent) {
                    depth -= 1;
                } else {
                    chunks.push('\n');
                }
                break;
            case 'bracketClose':
                if (afterComma || chunks[chunks.length - 1] !== '\n') {
                    chunks.push('\n');
                }
                depth = Math.max(0, depth - 1);
                chunks.push(repeatIndent(options.indentUnit, depth));
                chunks.push(']');
                needIndent = false;
                break;
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

function isEmptyBlock(
    tokens: readonly JsonToken[],
    openIndex: number,
    type: 'brace' | 'bracket',
): boolean {
    const closeKind = type === 'brace' ? 'braceClose' : 'bracketClose';
    const next = tokens[openIndex + 1];
    return next?.kind === closeKind;
}

function repeatIndent(indentUnit: string, depth: number): string {
    return indentUnit.repeat(depth);
}
