import { Diagnostic } from '../types';
import { HtmlToken, HtmlTokenKind, HtmlTokenizeResult } from './types';

const WHITESPACE_ONLY_RE = /^\s*$/;

/** HTML5 void elements — no closing tag and no children. */
const VOID_ELEMENTS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

/**
 * Elements whose content is raw text until the matching close tag
 * (HTML5 "raw text" / RCDATA elements). Inner markup is not tokenized.
 */
const RAW_TEXT_ELEMENTS = new Set([
    'script',
    'style',
    'textarea',
    'title',
    'xmp',
    'iframe',
    'noembed',
    'noframes',
    'noscript',
    'plaintext',
]);

export function tokenizeHtml(input: string): HtmlTokenizeResult {
    const tokens: HtmlToken[] = [];
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

        if (parsed.token.kind === 'openTag' && RAW_TEXT_ELEMENTS.has(parsed.token.name)) {
            const rawContent = readRawTextUntilClose(input, cursor, parsed.token.name, diagnostics);
            if (rawContent.token !== null) {
                tokens.push(rawContent.token);
            }
            if (rawContent.closeToken !== null) {
                tokens.push(rawContent.closeToken);
            }
            cursor = rawContent.nextCursor;
        }
    }

    return { tokens, diagnostics };
}

function tryReadToken(
    input: string,
    start: number,
    diagnostics: Diagnostic[],
): { token: HtmlToken; nextCursor: number } {
    if (input.startsWith('<!--', start)) {
        return readFixedTerminatedToken(input, start, '-->', 'comment', diagnostics);
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
    kind: Extract<HtmlTokenKind, 'comment'>,
    diagnostics: Diagnostic[],
): { token: HtmlToken; nextCursor: number } {
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
): { token: HtmlToken; nextCursor: number } {
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
): { token: HtmlToken; nextCursor: number } {
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
): HtmlToken {
    const isClose = raw.startsWith('</');
    const name = extractTagName(raw);
    const isSelfClosingMarkup = !isClose && /\/\s*>$/.test(raw);
    const isVoid = VOID_ELEMENTS.has(name);

    const kind: HtmlTokenKind = isClose
        ? 'closeTag'
        : isSelfClosingMarkup || isVoid
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
        name,
    };
}

function extractTagName(raw: string): string {
    const content = raw.replace(/^<\//, '').replace(/^</, '').replace(/\/?>$/, '').trimStart();
    const end = content.search(/[\s/>]/);
    const name = end === -1 ? content : content.slice(0, end);
    return name.toLowerCase();
}

/**
 * Reads raw text until the matching close tag (case-insensitive), then the close tag itself.
 * Used for script/style/textarea/title and other raw-text elements.
 */
function readRawTextUntilClose(
    input: string,
    start: number,
    tagName: string,
    diagnostics: Diagnostic[],
): {
    token: HtmlToken | null;
    closeToken: HtmlToken | null;
    nextCursor: number;
} {
    const closePattern = `</${tagName}`;
    let cursor = start;
    while (cursor < input.length) {
        const remaining = input.slice(cursor);
        const lower = remaining.toLowerCase();
        const idx = lower.indexOf(closePattern.toLowerCase());
        if (idx === -1) {
            diagnostics.push({
                severity: 'warning',
                message: `Unterminated raw-text element <${tagName}>.`,
                start,
                end: input.length,
            });
            const raw = input.slice(start);
            if (raw.length === 0) {
                return { token: null, closeToken: null, nextCursor: input.length };
            }
            return {
                token: {
                    kind: 'text',
                    start,
                    end: input.length,
                    raw,
                    isWhitespaceOnly: WHITESPACE_ONLY_RE.test(raw),
                },
                closeToken: null,
                nextCursor: input.length,
            };
        }

        const candidate = cursor + idx;
        const afterName = candidate + closePattern.length;
        const nextCh = input[afterName];
        // Valid close tag: </name> or </name ...>
        if (nextCh === '>' || nextCh === undefined || /[\s/>]/.test(nextCh)) {
            const textEnd = candidate;
            const closeEnd = findTagEnd(input, candidate);
            const closeNext = closeEnd === -1 ? input.length : closeEnd + 1;
            const textRaw = input.slice(start, textEnd);
            const closeRaw = input.slice(candidate, closeNext);

            const textToken: HtmlToken | null =
                textRaw.length > 0
                    ? {
                          kind: 'text',
                          start,
                          end: textEnd,
                          raw: textRaw,
                          isWhitespaceOnly: WHITESPACE_ONLY_RE.test(textRaw),
                      }
                    : null;

            const closeToken: HtmlToken = {
                kind: 'closeTag',
                start: candidate,
                end: closeNext,
                raw: closeRaw,
                name: tagName.toLowerCase(),
            };

            return {
                token: textToken,
                closeToken,
                nextCursor: closeNext,
            };
        }

        cursor = candidate + 1;
    }

    return { token: null, closeToken: null, nextCursor: input.length };
}

function startsWithIgnoreCase(input: string, start: number, expected: string): boolean {
    return input.slice(start, start + expected.length).toLowerCase() === expected.toLowerCase();
}
