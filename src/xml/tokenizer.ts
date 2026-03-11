import { Diagnostic, TokenizeResult, XmlToken, XmlTokenKind } from '../types';

const WHITESPACE_ONLY_RE = /^\s*$/;

export function tokenizeXml(input: string): TokenizeResult {
    const tokens: XmlToken[] = [];
    const diagnostics: Diagnostic[] = [];
    let cursor = 0;

    while (cursor < input.length) {
        if (input[cursor] !== '<') {
            const next = input.indexOf('<', cursor);
            const end = next === -1 ? input.length : next;
            const raw = input.slice(cursor, end);
            tokens.push({
                kind: 'text',
                start: cursor,
                end,
                raw,
                isWhitespaceOnly: WHITESPACE_ONLY_RE.test(raw),
            });
            cursor = end;
            continue;
        }

        const parsed = tryReadToken(input, cursor, diagnostics);
        tokens.push(parsed.token);
        cursor = parsed.nextCursor;
    }

    return { tokens, diagnostics };
}

function tryReadToken(
    input: string,
    start: number,
    diagnostics: Diagnostic[],
): { token: XmlToken; nextCursor: number } {
    if (input.startsWith('<!--', start)) {
        return readFixedTerminatedToken(input, start, '-->', 'comment', diagnostics);
    }
    if (input.startsWith('<![CDATA[', start)) {
        return readFixedTerminatedToken(input, start, ']]>', 'cdata', diagnostics);
    }
    if (input.startsWith('<?xml', start)) {
        return readFixedTerminatedToken(input, start, '?>', 'declaration', diagnostics);
    }
    if (input.startsWith('<?', start)) {
        return readFixedTerminatedToken(input, start, '?>', 'processingInstruction', diagnostics);
    }
    if (startsWithIgnoreCase(input, start, '<!DOCTYPE')) {
        return readDoctypeToken(input, start, diagnostics);
    }
    if (input.startsWith('</', start)) {
        return readTagToken(input, start, 'closeTag', diagnostics);
    }
    return readTagToken(input, start, 'openTag', diagnostics);
}

function readFixedTerminatedToken(
    input: string,
    start: number,
    terminator: string,
    kind: Extract<XmlTokenKind, 'comment' | 'cdata' | 'declaration' | 'processingInstruction'>,
    diagnostics: Diagnostic[],
): { token: XmlToken; nextCursor: number } {
    const endAt = input.indexOf(terminator, start);
    const end = endAt === -1 ? input.length : endAt + terminator.length;
    if (endAt === -1) {
        diagnostics.push({
            severity: 'warning',
            message: `Unterminated ${kind} token.`,
            start,
            end,
        });
    }
    return {
        token: { kind, start, end, raw: input.slice(start, end) },
        nextCursor: end,
    };
}

function readDoctypeToken(
    input: string,
    start: number,
    diagnostics: Diagnostic[],
): { token: XmlToken; nextCursor: number } {
    let cursor = start + '<!DOCTYPE'.length;
    let quote: '"' | "'" | null = null;
    let bracketDepth = 0;

    while (cursor < input.length) {
        const ch = input[cursor];
        if (quote !== null) {
            if (ch === quote) {
                quote = null;
            }
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '[') {
            bracketDepth += 1;
        } else if (ch === ']') {
            bracketDepth = Math.max(0, bracketDepth - 1);
        } else if (ch === '>' && bracketDepth === 0) {
            const end = cursor + 1;
            return {
                token: { kind: 'doctype', start, end, raw: input.slice(start, end) },
                nextCursor: end,
            };
        }
        cursor += 1;
    }

    diagnostics.push({
        severity: 'warning',
        message: 'Unterminated doctype token.',
        start,
        end: input.length,
    });
    return {
        token: { kind: 'doctype', start, end: input.length, raw: input.slice(start) },
        nextCursor: input.length,
    };
}

function readTagToken(
    input: string,
    start: number,
    defaultKind: 'openTag' | 'closeTag',
    diagnostics: Diagnostic[],
): { token: XmlToken; nextCursor: number } {
    const end = findTagEnd(input, start);
    if (end === -1) {
        diagnostics.push({
            severity: 'warning',
            message: 'Unterminated tag token.',
            start,
            end: input.length,
        });
        const raw = input.slice(start);
        return {
            token: createTagToken(raw, start, input.length, defaultKind),
            nextCursor: input.length,
        };
    }
    const nextCursor = end + 1;
    const raw = input.slice(start, nextCursor);
    return {
        token: createTagToken(raw, start, nextCursor, defaultKind),
        nextCursor,
    };
}

function findTagEnd(input: string, start: number): number {
    let cursor = start + 1;
    let quote: '"' | "'" | null = null;
    while (cursor < input.length) {
        const ch = input[cursor];
        if (quote !== null) {
            if (ch === quote) {
                quote = null;
            }
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '>') {
            return cursor;
        }
        cursor += 1;
    }
    return -1;
}

function createTagToken(
    raw: string,
    start: number,
    end: number,
    defaultKind: 'openTag' | 'closeTag',
): XmlToken {
    const isClose = raw.startsWith('</');
    const isSelfClosing = !isClose && raw.endsWith('/>');
    const kind: XmlTokenKind = isClose
        ? 'closeTag'
        : isSelfClosing
          ? 'selfClosingTag'
          : defaultKind;

    if (kind !== 'openTag' && kind !== 'closeTag' && kind !== 'selfClosingTag') {
        return { kind: 'text', start, end, raw, isWhitespaceOnly: false };
    }

    return {
        kind,
        start,
        end,
        raw,
        name: extractTagName(raw),
    };
}

function extractTagName(raw: string): string {
    const content = raw
        .replace(/^<\??\/?/, '')
        .replace(/\/?>$/, '')
        .trimStart();
    const end = content.search(/\s/);
    if (end === -1) {
        return content;
    }
    return content.slice(0, end);
}

function startsWithIgnoreCase(input: string, start: number, expected: string): boolean {
    return input.slice(start, start + expected.length).toLowerCase() === expected.toLowerCase();
}
