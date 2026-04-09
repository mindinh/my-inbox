/**
 * Locale-aware number formatting and DB normalization utilities.
 */

/** Returns the decimal and thousand separator characters for a given locale. */
export function getLocaleNumberSeparators(locale: string): { decimal: string; thousand: string } {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.89);
    let decimal = '.';
    let thousand = '';

    for (const part of parts) {
        if (part.type === 'decimal') decimal = part.value;
        if (part.type === 'group') thousand = part.value;
    }

    return { decimal, thousand };
}

/**
 * Parse a locale-formatted number string into a JS number.
 */
export function parseLocaleNumber(value: string, locale: string): number | null {
    if (value == null || String(value).trim() === '') return null;

    const str = String(value).trim();
    const { decimal, thousand } = getLocaleNumberSeparators(locale);

    let normalized = str;
    if (thousand) {
        normalized = normalized.split(thousand).join('');
    }
    normalized = normalized.replace(/[\s\u00A0]/g, '');

    if (decimal !== '.') {
        normalized = normalized.replace(decimal, '.');
    }

    const num = Number(normalized);
    return isNaN(num) ? null : num;
}

function isDBFormat(str: string, locale?: string, scale?: number): boolean {
    if (!/^-?\d+(\.\d+)?$/.test(str)) return false;
    if (!str.includes('.')) return true;

    if (locale) {
        const { thousand } = getLocaleNumberSeparators(locale);
        if (thousand === '.') {
            const dotIndex = str.indexOf('.');
            const decimals = str.slice(dotIndex + 1);
            if (decimals.length === 3) {
                if (scale !== undefined && scale === 3) return true;
                return false;
            }
        }
    }

    return true;
}

/**
 * Format a number for locale display.
 */
export function formatLocaleNumber(
    value: number | string | null | undefined,
    locale: string,
    scale?: number
): string {
    if (value == null || String(value).trim() === '') return '';

    let num: number | null;

    if (typeof value === 'number') {
        num = value;
    } else {
        const str = String(value).trim();
        if (isDBFormat(str, locale, scale)) {
            num = Number(str);
        } else {
            num = parseLocaleNumber(str, locale);
        }
    }

    if (num === null || isNaN(num)) return String(value);

    const options: Intl.NumberFormatOptions = {};
    if (scale !== undefined && scale >= 0) {
        options.minimumFractionDigits = scale;
        options.maximumFractionDigits = scale;
    } else {
        options.maximumFractionDigits = 20;
    }

    return new Intl.NumberFormat(locale, options).format(num);
}

/**
 * Normalize a locale-formatted number string to DB format.
 */
export function normalizeNumberForDB(value: string, locale: string, scale?: number): string {
    if (value == null || String(value).trim() === '') return '';

    const str = String(value).trim();

    let num: number | null;

    if (isDBFormat(str, locale, scale)) {
        num = Number(str);
    } else {
        num = parseLocaleNumber(str, locale);
    }

    if (num === null) return String(value);

    if (scale !== undefined && scale >= 0) {
        return num.toFixed(scale);
    }

    return num.toString();
}
