import { defaultConfig } from '../src/config';
import { MessageRenderer } from '../src/message-renderer';
import type { Message } from '../src/types';

describe('MessageRenderer attachments', () => {
    const renderer = new MessageRenderer(defaultConfig);

    it('renders spreadsheet attachments with a file badge and descriptor', () => {
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

        expect(html).toContain('sw-msg-file-badge">XLSX<');
        expect(html).toContain('Hoja de calculo');
        expect(html).toContain('sw-msg-file-cta');
        expect(html).toContain('Asiento-202508.xlsx');
    });

    it('renders pdf attachments with a PDF descriptor', () => {
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

        expect(html).toContain('sw-msg-file-badge">PDF<');
        expect(html).toContain('Documento PDF');
        expect(html).toContain('Descargar PDF');
    });
});
