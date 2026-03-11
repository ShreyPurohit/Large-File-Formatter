import { FormatOptions, XmlToken } from '../types';

export function formatXmlFromTokens(tokens: readonly XmlToken[], options: FormatOptions): string {
    const chunks: string[] = [];
    let depth = 0;
    let previousToken: XmlToken | null = null;
    let lineStart = true;

    for (const token of tokens) {
        switch (token.kind) {
            case 'declaration':
            case 'doctype':
            case 'processingInstruction':
            case 'comment':
            case 'cdata': {
                const inline = shouldInline(token, previousToken);
                writeToken(chunks, token.raw, inline ? null : depth, options.indentUnit, lineStart);
                lineStart = false;
                break;
            }
            case 'openTag': {
                const inline = shouldInline(token, previousToken);
                writeToken(chunks, token.raw, inline ? null : depth, options.indentUnit, lineStart);
                depth += 1;
                lineStart = false;
                break;
            }
            case 'closeTag': {
                depth = Math.max(0, depth - 1);
                const inline = shouldInline(token, previousToken);
                writeToken(chunks, token.raw, inline ? null : depth, options.indentUnit, lineStart);
                lineStart = false;
                break;
            }
            case 'selfClosingTag': {
                const inline = shouldInline(token, previousToken);
                writeToken(chunks, token.raw, inline ? null : depth, options.indentUnit, lineStart);
                lineStart = false;
                break;
            }
            case 'text': {
                if (token.isWhitespaceOnly) {
                    previousToken = token;
                    continue;
                }
                if (lineStart) {
                    chunks.push(repeatIndent(options.indentUnit, depth));
                }
                chunks.push(token.raw);
                lineStart = token.raw.endsWith('\n');
                break;
            }
            default: {
                assertNever(token);
            }
        }

        previousToken = token;
    }

    const formatted = chunks.join('');
    if (options.insertFinalNewline && !formatted.endsWith('\n')) {
        return `${formatted}\n`;
    }
    return formatted;
}

function writeToken(
    chunks: string[],
    raw: string,
    depthOrNull: number | null,
    indentUnit: string,
    lineStart: boolean,
): void {
    if (depthOrNull === null) {
        chunks.push(raw);
        return;
    }
    if (!lineStart && chunks.length > 0 && !chunks[chunks.length - 1].endsWith('\n')) {
        chunks.push('\n');
    }
    chunks.push(repeatIndent(indentUnit, depthOrNull));
    chunks.push(raw);
}

function shouldInline(token: XmlToken, previousToken: XmlToken | null): boolean {
    if (previousToken === null) {
        return false;
    }
    if (previousToken.kind === 'text' && !previousToken.isWhitespaceOnly) {
        return true;
    }
    if (token.kind === 'closeTag' && previousToken.kind === 'openTag') {
        return true;
    }
    return false;
}

function repeatIndent(indentUnit: string, depth: number): string {
    return indentUnit.repeat(depth);
}

function assertNever(value: never): never {
    throw new Error(`Unexpected token kind: ${JSON.stringify(value)}`);
}
