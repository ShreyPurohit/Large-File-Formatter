import { Diagnostic } from '../types';
import { JsonToken, JsonTokenizeResult } from './types';

const LITERALS = ['true', 'false', 'null'] as const;
const NUMBER_START = /[-0-9]/;
const NUMBER_CONTINUE = /[0-9eE.+-]/;

export function tokenizeJson(input: string): JsonTokenizeResult {
    const tokens: JsonToken[] = [];
    const diagnostics: Diagnostic[] = [];
    let cursor = skipWhitespace(input, 0);

    while (cursor < input.length) {
        const ch = input[cursor];
        if (ch === '{') {
            tokens.push(emit('braceOpen', cursor, cursor + 1, input));
            cursor = skipWhitespace(input, cursor + 1);
            continue;
        }
        if (ch === '}') {
            tokens.push(emit('braceClose', cursor, cursor + 1, input));
            cursor = skipWhitespace(input, cursor + 1);
            continue;
        }
        if (ch === '[') {
            tokens.push(emit('bracketOpen', cursor, cursor + 1, input));
            cursor = skipWhitespace(input, cursor + 1);
            continue;
        }
        if (ch === ']') {
            tokens.push(emit('bracketClose', cursor, cursor + 1, input));
            cursor = skipWhitespace(input, cursor + 1);
            continue;
        }
        if (ch === ',') {
            tokens.push(emit('comma', cursor, cursor + 1, input));
            cursor = skipWhitespace(input, cursor + 1);
            continue;
        }
        if (ch === ':') {
            tokens.push(emit('colon', cursor, cursor + 1, input));
            cursor = skipWhitespace(input, cursor + 1);
            continue;
        }
        if (ch === '"') {
            const result = readString(input, cursor, diagnostics);
            tokens.push(result.token);
            cursor = skipWhitespace(input, result.nextCursor);
            continue;
        }
        if (NUMBER_START.test(ch)) {
            const result = readNumber(input, cursor, diagnostics);
            tokens.push(result.token);
            cursor = skipWhitespace(input, result.nextCursor);
            continue;
        }
        const literalResult = tryReadLiteral(input, cursor);
        if (literalResult) {
            tokens.push(literalResult.token);
            cursor = skipWhitespace(input, literalResult.nextCursor);
            continue;
        }
        diagnostics.push({
            severity: 'warning',
            message: `Unexpected character: ${JSON.stringify(ch)}`,
            start: cursor,
            end: cursor + 1,
        });
        cursor += 1;
    }

    return { tokens, diagnostics };
}

function skipWhitespace(input: string, start: number): number {
    let i = start;
    while (i < input.length && /[\s]/.test(input[i])) {
        i += 1;
    }
    return i;
}

function emit(kind: JsonToken['kind'], start: number, end: number, input: string): JsonToken {
    return { kind, start, end, raw: input.slice(start, end) };
}

function readString(
    input: string,
    start: number,
    diagnostics: Diagnostic[],
): { token: JsonToken; nextCursor: number } {
    let cursor = start + 1;
    while (cursor < input.length) {
        const ch = input[cursor];
        if (ch === '\\') {
            cursor += 1;
            if (cursor >= input.length) {
                break;
            }
            cursor += 1;
            continue;
        }
        if (ch === '"') {
            const end = cursor + 1;
            return {
                token: { kind: 'string', start, end, raw: input.slice(start, end) },
                nextCursor: end,
            };
        }
        cursor += 1;
    }
    diagnostics.push({
        severity: 'warning',
        message: 'Unterminated string.',
        start,
        end: input.length,
    });
    return {
        token: { kind: 'string', start, end: input.length, raw: input.slice(start) },
        nextCursor: input.length,
    };
}

function readNumber(
    input: string,
    start: number,
    _diagnostics: Diagnostic[],
): { token: JsonToken; nextCursor: number } {
    let cursor = start;
    if (input[cursor] === '-') {
        cursor += 1;
    }
    while (cursor < input.length && /[0-9]/.test(input[cursor])) {
        cursor += 1;
    }
    if (input[cursor] === '.') {
        cursor += 1;
        while (cursor < input.length && /[0-9]/.test(input[cursor])) {
            cursor += 1;
        }
    }
    if (input[cursor] === 'e' || input[cursor] === 'E') {
        cursor += 1;
        if (input[cursor] === '+' || input[cursor] === '-') {
            cursor += 1;
        }
        while (cursor < input.length && /[0-9]/.test(input[cursor])) {
            cursor += 1;
        }
    }
    return {
        token: { kind: 'number', start, end: cursor, raw: input.slice(start, cursor) },
        nextCursor: cursor,
    };
}

function tryReadLiteral(
    input: string,
    start: number,
): { token: JsonToken; nextCursor: number } | null {
    for (const lit of LITERALS) {
        if (input.slice(start, start + lit.length) === lit) {
            const end = start + lit.length;
            const nextCh = input[end];
            if (nextCh === undefined || /[\s\]},:]/.test(nextCh)) {
                return {
                    token: { kind: 'literal', start, end, raw: lit },
                    nextCursor: end,
                };
            }
        }
    }
    return null;
}
