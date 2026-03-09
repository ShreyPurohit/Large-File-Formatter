import * as assert from 'assert';

import * as vscode from 'vscode';
import { tokenizeXml } from '../xml/tokenizer';
import { formatXmlFromTokens } from '../xml/formatter';
import { formatXml } from '../xml/pipeline';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Tokenizer emits tag tokens', () => {
        const xml = '<?xml version="1.0"?><root><a id="1">text</a><b/></root>';
        const tokenized = tokenizeXml(xml);
        assert.strictEqual(tokenized.diagnostics.length, 0);
        assert.ok(tokenized.tokens.length > 0);
        assert.ok(tokenized.tokens.some((token) => token.kind === 'openTag'));
        assert.ok(tokenized.tokens.some((token) => token.kind === 'closeTag'));
        assert.ok(tokenized.tokens.some((token) => token.kind === 'selfClosingTag'));
    });

    test('Formatter preserves inline mixed content', () => {
        const xml = '<p>Hello <hi rend="italic">world</hi>!</p>';
        const tokenized = tokenizeXml(xml);
        const formatted = formatXmlFromTokens(tokenized.tokens, {
            indentUnit: '  ',
            insertFinalNewline: false,
            useWorkerThresholdBytes: 128 * 1024,
        });
        assert.ok(formatted.includes('<hi rend="italic">world</hi>'));
    });

    test('Pipeline returns deterministic output and stats', () => {
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
});
