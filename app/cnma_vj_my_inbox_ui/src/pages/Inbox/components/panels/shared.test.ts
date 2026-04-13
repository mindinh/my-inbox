import { describe, it, expect } from 'vitest';
import { cleanFileName, friendlyFileType } from '@/pages/Inbox/components/panels/shared';

describe('cleanFileName', () => {
    it('returns undefined for undefined', () => {
        expect(cleanFileName(undefined)).toBeUndefined();
    });

    it('returns name unchanged when no duplicate extension', () => {
        expect(cleanFileName('report.xlsx')).toBe('report.xlsx');
    });

    it('removes duplicate extension (same case)', () => {
        expect(cleanFileName('report.xlsx.xlsx')).toBe('report.xlsx');
    });

    it('removes duplicate extension (different case)', () => {
        expect(cleanFileName('report.PDF.pdf')).toBe('report.pdf');
    });

    it('preserves different extensions', () => {
        expect(cleanFileName('report.bak.xlsx')).toBe('report.bak.xlsx');
    });

    it('handles filenames without extensions', () => {
        expect(cleanFileName('readme')).toBe('readme');
    });

    it('handles filenames with multiple dots', () => {
        expect(cleanFileName('my.report.v2.xlsx')).toBe('my.report.v2.xlsx');
    });
});

describe('friendlyFileType', () => {
    it('returns File for undefined', () => {
        expect(friendlyFileType(undefined)).toBe('File');
    });

    it('maps application/pdf to PDF', () => {
        expect(friendlyFileType('application/pdf')).toBe('PDF');
    });

    it('maps excel MIME type', () => {
        expect(friendlyFileType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('Excel Spreadsheet');
    });

    it('maps image/png', () => {
        expect(friendlyFileType('image/png')).toBe('PNG Image');
    });

    it('returns raw MIME for unknown types', () => {
        expect(friendlyFileType('application/x-custom')).toBe('application/x-custom');
    });

    it('is case-insensitive', () => {
        expect(friendlyFileType('Application/PDF')).toBe('PDF');
    });
});
