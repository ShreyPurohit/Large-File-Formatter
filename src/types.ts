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

type XmlDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface XmlDiagnostic {
    readonly severity: XmlDiagnosticSeverity;
    readonly message: string;
    readonly start: number;
    readonly end: number;
}

export interface TokenizeResult {
    readonly tokens: XmlToken[];
    readonly diagnostics: XmlDiagnostic[];
}

export interface XmlFormatOptions {
    readonly indentUnit: string;
    readonly insertFinalNewline: boolean;
    readonly useWorkerThresholdBytes: number;
}

interface XmlFormatStats {
    readonly tokenCount: number;
    readonly durationMs: number;
    readonly usedFallback: boolean;
}

export interface XmlFormatResult {
    readonly formattedText: string;
    readonly diagnostics: XmlDiagnostic[];
    readonly stats: XmlFormatStats;
}

export interface TextOffsetEdit {
    readonly start: number;
    readonly end: number;
    readonly newText: string;
}

export interface StructuralValidationResult {
    readonly isValid: boolean;
    readonly diagnostics: XmlDiagnostic[];
}

export interface WorkerFormatRequest {
    readonly requestId: string;
    readonly text: string;
    readonly options: XmlFormatOptions;
}

export interface WorkerFormatSuccess {
    readonly requestId: string;
    readonly ok: true;
    readonly result: XmlFormatResult;
    readonly edits: TextOffsetEdit[];
}

export interface WorkerFormatFailure {
    readonly requestId: string;
    readonly ok: false;
    readonly message: string;
}

export type WorkerFormatResponse = WorkerFormatSuccess | WorkerFormatFailure;
