/** Shared diagnostic shape for all languages. */
export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface Diagnostic {
    readonly severity: DiagnosticSeverity;
    readonly message: string;
    readonly start: number;
    readonly end: number;
}

/** Shared format options for worker and all language pipelines. */
export interface FormatOptions {
    readonly indentUnit: string;
    readonly insertFinalNewline: boolean;
    readonly useWorkerThresholdBytes: number;
}

export interface FormatStats {
    readonly tokenCount: number;
    readonly durationMs: number;
    readonly usedFallback: boolean;
}

/** Shared format result shape for worker and all language pipelines. */
export interface FormatResult {
    readonly formattedText: string;
    readonly diagnostics: Diagnostic[];
    readonly stats: FormatStats;
}

export type XmlTokenKind =
    | 'declaration'
    | 'doctype'
    | 'processingInstruction'
    | 'comment'
    | 'cdata'
    | 'openTag'
    | 'closeTag'
    | 'selfClosingTag'
    | 'text';

interface XmlTokenBase {
    readonly kind: XmlTokenKind;
    readonly start: number;
    readonly end: number;
    readonly raw: string;
}

interface XmlTagToken extends XmlTokenBase {
    readonly kind: 'openTag' | 'closeTag' | 'selfClosingTag';
    readonly name: string;
}

interface XmlTextToken extends XmlTokenBase {
    readonly kind: 'text';
    readonly isWhitespaceOnly: boolean;
}

interface XmlSpecialToken extends XmlTokenBase {
    readonly kind: 'declaration' | 'doctype' | 'processingInstruction' | 'comment' | 'cdata';
}

export type XmlToken = XmlTagToken | XmlTextToken | XmlSpecialToken;

export interface TokenizeResult {
    readonly tokens: XmlToken[];
    readonly diagnostics: Diagnostic[];
}

export interface StructuralValidationResult {
    readonly isValid: boolean;
    readonly diagnostics: Diagnostic[];
}

export interface TextOffsetEdit {
    readonly start: number;
    readonly end: number;
    readonly newText: string;
}

export type FormatLanguage = 'xml' | 'json';

export interface WorkerFormatRequest {
    readonly requestId: string;
    readonly language: FormatLanguage;
    readonly text: string;
    readonly options: FormatOptions;
}

export interface WorkerFormatSuccess {
    readonly requestId: string;
    readonly ok: true;
    readonly result: FormatResult;
    readonly edits: TextOffsetEdit[];
}

export interface WorkerFormatFailure {
    readonly requestId: string;
    readonly ok: false;
    readonly message: string;
}

export type WorkerFormatResponse = WorkerFormatSuccess | WorkerFormatFailure;
