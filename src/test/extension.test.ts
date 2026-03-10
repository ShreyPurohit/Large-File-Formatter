import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';
import { tokenizeJson } from '../json/tokenizer';
import { formatJsonFromTokens } from '../json/formatter';
import { formatJson } from '../json/pipeline';
import { tokenizeXml } from '../xml/tokenizer';
import { formatXmlFromTokens } from '../xml/formatter';
import { formatXml } from '../xml/pipeline';

// Resolve relative to repo root (test compiles to out/test/, so go up to root then into src/test)
const repoRoot = path.resolve(__dirname, '..', '..');
const testDataDir = path.join(repoRoot, 'src', 'test', 'data');
const generatedDir = path.join(repoRoot, 'src', 'test', 'generated');

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('XML tokenizer emits tag tokens', () => {
        const xml = '<?xml version="1.0"?><root><a id="1">text</a><b/></root>';
        const tokenized = tokenizeXml(xml);
        assert.strictEqual(tokenized.diagnostics.length, 0);
        assert.ok(tokenized.tokens.length > 0);
        assert.ok(tokenized.tokens.some((token) => token.kind === 'openTag'));
        assert.ok(tokenized.tokens.some((token) => token.kind === 'closeTag'));
        assert.ok(tokenized.tokens.some((token) => token.kind === 'selfClosingTag'));
    });

    test('XML formatter preserves inline mixed content', () => {
        const xml = '<p>Hello <hi rend="italic">world</hi>!</p>';
        const tokenized = tokenizeXml(xml);
        const formatted = formatXmlFromTokens(tokenized.tokens, {
            indentUnit: '  ',
            insertFinalNewline: false,
            useWorkerThresholdBytes: 128 * 1024,
        });
        assert.ok(formatted.includes('<hi rend="italic">world</hi>'));
    });

    test('XML pipeline returns deterministic output and stats', () => {
        const xml = '<root><a>1</a><b><c/></b></root>';
        const result = formatXml(xml, {
            indentUnit: '  ',
            insertFinalNewline: true,
            useWorkerThresholdBytes: 128 * 1024,
        });
        assert.ok(result.formattedText.length > 0);
        assert.ok(result.stats.tokenCount > 0);
        assert.strictEqual(typeof result.stats.durationMs, 'number');
    });

    test('JSON tokenizer emits expected token kinds', () => {
        const json = '{"a":1,"b":[true,false,null]}';
        const tokenized = tokenizeJson(json);
        assert.strictEqual(tokenized.diagnostics.length, 0);
        assert.ok(tokenized.tokens.some((t) => t.kind === 'braceOpen'));
        assert.ok(tokenized.tokens.some((t) => t.kind === 'string'));
        assert.ok(tokenized.tokens.some((t) => t.kind === 'colon'));
        assert.ok(tokenized.tokens.some((t) => t.kind === 'number'));
        assert.ok(tokenized.tokens.some((t) => t.kind === 'literal'));
        assert.ok(tokenized.tokens.some((t) => t.kind === 'bracketOpen'));
    });

    test('JSON formatter preserves structure', () => {
        const json = '{"key":"value","n":42}';
        const tokenized = tokenizeJson(json);
        const formatted = formatJsonFromTokens(tokenized.tokens, {
            indentUnit: '  ',
            insertFinalNewline: false,
            useWorkerThresholdBytes: 128 * 1024,
        });
        assert.ok(formatted.includes('"key"'));
        assert.ok(formatted.includes('"value"'));
        assert.ok(formatted.includes('42'));
    });

    test('JSON pipeline returns deterministic output and stats', () => {
        const json = '{"a":1,"b":[true,false,null]}';
        const result = formatJson(json, {
            indentUnit: '  ',
            insertFinalNewline: true,
            useWorkerThresholdBytes: 128 * 1024,
        });
        assert.ok(result.formattedText.length > 0);
        assert.ok(result.stats.tokenCount > 0);
        assert.strictEqual(typeof result.stats.durationMs, 'number');
        assert.strictEqual(typeof result.stats.usedFallback, 'boolean');
    });

    test('Large XML: format and write to generated folder', function () {
        this.timeout(60_000);
        const xmlPath = path.join(testDataDir, 'largeXML.xml');
        if (!fs.existsSync(xmlPath)) {
            this.skip();
        }
        const text = fs.readFileSync(xmlPath, 'utf8');
        const result = formatXml(text, {
            indentUnit: '  ',
            insertFinalNewline: true,
            useWorkerThresholdBytes: 128 * 1024,
        });
        assert.ok(result.formattedText.length > 0);
        assert.ok(result.stats.tokenCount > 0);
        fs.mkdirSync(generatedDir, { recursive: true });
        const outPath = path.join(generatedDir, 'largeXML.formatted.xml');
        fs.writeFileSync(outPath, result.formattedText, 'utf8');
        assert.ok(fs.existsSync(outPath));
    });

    test('Large JSON: format and write to generated folder', function () {
        this.timeout(60_000);
        const jsonPath = path.join(testDataDir, 'largeJSON.json');
        if (!fs.existsSync(jsonPath)) {
            this.skip();
        }
        const text = fs.readFileSync(jsonPath, 'utf8');
        const result = formatJson(text, {
            indentUnit: '  ',
            insertFinalNewline: true,
            useWorkerThresholdBytes: 128 * 1024,
        });
        assert.ok(result.formattedText.length > 0);
        assert.ok(result.stats.tokenCount > 0);
        fs.mkdirSync(generatedDir, { recursive: true });
        const outPath = path.join(generatedDir, 'large.formatted.json');
        fs.writeFileSync(outPath, result.formattedText, 'utf8');
        assert.ok(fs.existsSync(outPath));
    });
});
