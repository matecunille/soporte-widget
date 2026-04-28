import { defaultConfig } from '../src/config';
import { MessageRenderer } from '../src/message-renderer';
import type { Message } from '../src/types';

describe('MessageRenderer attachments', () => {
    const renderer = new MessageRenderer(defaultConfig);

    it('renders spreadsheet attachments with type badge and download icon', () => {
        const message: Message = {
            content: 'test',
            sentAt: '2024-01-01T10:00:00Z',
            isFromLead: true,
            attachments: [{
                url: 'https://example.com/Asiento-202508.xlsx',
                fileName: 'Asiento-202508.xlsx',
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                kind: 'file'
            }]
        };

        const html = renderer.renderSingleMessage(message, true, true, false);

        expect(html).toContain('sw-msg-file');
        expect(html).toContain('sw-msg-file-badge');
        expect(html).toContain('sw-msg-file-download');
        expect(html).toContain('Asiento-202508.xlsx');        // original filename in data attr
        expect(html).toContain('Asiento-202508</span>');      // display name without extension
        expect(html).not.toContain('sw-msg-file-icon');        // removed
    });

    it('renders pdf attachments with PDF badge and download icon', () => {
        const message: Message = {
            content: '',
            sentAt: '2024-01-01T10:00:00Z',
            isFromLead: false,
            attachments: [{
                url: 'https://example.com/recibo.pdf',
                fileName: 'recibo.pdf',
                contentType: 'application/pdf',
                kind: 'pdf'
            }]
        };

        const html = renderer.renderSingleMessage(message, true, true, false);

        expect(html).toContain('sw-msg-file');
        expect(html).toContain('sw-msg-file-badge');
        expect(html).toContain('recibo</span>');               // display name without extension
        expect(html).toContain('sw-msg-file-download');
        expect(html).not.toContain('sw-msg-file-icon');
    });

    it('renders **bold** text as <strong>', () => {
        const message: Message = {
            content: 'Hello **world** test',
            sentAt: '2024-01-01T10:00:00Z',
            isFromLead: true,
            attachments: []
        };
        const html = renderer.renderSingleMessage(message, true, true, false);
        expect(html).toContain('<strong>world</strong>');
        expect(html).not.toContain('**world**');
    });
});
