export type HtmlTokenKind =
    | 'doctype'
    | 'comment'
    | 'openTag'
    | 'closeTag'
    | 'selfClosingTag'
    | 'text';

interface HtmlTokenBase {
    readonly kind: HtmlTokenKind;
    readonly start: number;
    readonly end: number;
    readonly raw: string;
}

interface HtmlTagToken extends HtmlTokenBase {
    readonly kind: 'openTag' | 'closeTag' | 'selfClosingTag';
    readonly name: string;
}

interface HtmlTextToken extends HtmlTokenBase {
    readonly kind: 'text';
    readonly isWhitespaceOnly: boolean;
}

interface HtmlSpecialToken extends HtmlTokenBase {
    readonly kind: 'doctype' | 'comment';
}

export type HtmlToken = HtmlTagToken | HtmlTextToken | HtmlSpecialToken;

export interface HtmlTokenizeResult {
    readonly tokens: HtmlToken[];
    readonly diagnostics: import('../types').Diagnostic[];
}
