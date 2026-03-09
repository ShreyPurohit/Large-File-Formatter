import { TextOffsetEdit } from '../types';

export function buildMinimalTextEdits(original: string, formatted: string): TextOffsetEdit[] {
    if (original === formatted) {
        return [];
    }

    const prefixLength = commonPrefixLength(original, formatted);
    const suffixLength = commonSuffixLength(original, formatted, prefixLength);

    return [
        {
            start: prefixLength,
            end: original.length - suffixLength,
            newText: formatted.slice(prefixLength, formatted.length - suffixLength),
        },
    ];
}

function commonPrefixLength(left: string, right: string): number {
    const length = Math.min(left.length, right.length);
    let index = 0;
    while (index < length && left[index] === right[index]) {
        index += 1;
    }
    return index;
}

function commonSuffixLength(left: string, right: string, prefixLength: number): number {
    const leftRemaining = left.length - prefixLength;
    const rightRemaining = right.length - prefixLength;
    const max = Math.min(leftRemaining, rightRemaining);

    let count = 0;
    while (count < max && left[left.length - 1 - count] === right[right.length - 1 - count]) {
        count += 1;
    }
    return count;
}
