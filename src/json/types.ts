export type JsonTokenKind =
    | 'braceOpen'
    | 'braceClose'
    | 'bracketOpen'
    | 'bracketClose'
    | 'comma'
    | 'colon'
    | 'string'
    | 'number'
    | 'literal';

export interface JsonToken {
    readonly kind: JsonTokenKind;
    readonly start: number;
    readonly end: number;
    readonly raw: string;
}

export interface JsonTokenizeResult {
    readonly tokens: JsonToken[];
    readonly diagnostics: import('../types').Diagnostic[];
}
