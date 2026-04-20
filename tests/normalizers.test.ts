/**
 * normalizers.test.ts
 *
 * Tests for backend DTO normalization functions.
 * Backend contract: consistent camelCase from Rame API.
 */

import { normalizeAttachment, normalizeHistoryPayload } from '../src/normalizers';
import type { AttachmentDTO, HistoryDTO } from '../src/types';

describe('normalizeAttachment', () => {
    const mockResolveUrl = (url: string | undefined): string | undefined => 
        url ? `https://api.example.com${url}` : url;

    it('should normalize attachment with sasUrl', () => {
        const attachment: AttachmentDTO = {
            sasUrl: '/secure/doc.pdf',
            fileName: 'document.pdf',
            contentType: 'application/pdf'
        };

        const result = normalizeAttachment(attachment, mockResolveUrl);

        expect(result.url).toBe('https://api.example.com/secure/doc.pdf');
        expect(result.fileName).toBe('document.pdf');
        expect(result.contentType).toBe('application/pdf');
        expect(result.kind).toBe('pdf');
    });

    it('should normalize image attachment', () => {
        const attachment: AttachmentDTO = {
            sasUrl: '/secure/photo.png',
            fileName: 'photo.png',
            contentType: 'image/png'
        };

        const result = normalizeAttachment(attachment, mockResolveUrl);

        expect(result.url).toBe('https://api.example.com/secure/photo.png');
        expect(result.kind).toBe('image');
    });

    it('should fallback to url if sasUrl not present', () => {
        const attachment: AttachmentDTO = {
            url: '/public/file.pdf',
            fileName: 'file.pdf'
        };

        const result = normalizeAttachment(attachment, mockResolveUrl);

        expect(result.url).toBe('https://api.example.com/public/file.pdf');
    });

    it('should default fileName to "Archivo"', () => {
        const attachment: AttachmentDTO = { sasUrl: '/files/unknown' };
        const result = normalizeAttachment(attachment, mockResolveUrl);
        expect(result.fileName).toBe('Archivo');
    });

    it('should infer content type from extension', () => {
        const attachment: AttachmentDTO = { sasUrl: '/files/doc.pdf' };
        const result = normalizeAttachment(attachment, mockResolveUrl);
        expect(result.contentType).toBe('application/pdf');
        expect(result.kind).toBe('pdf');
    });

    it('should handle unknown types as generic file', () => {
        const attachment: AttachmentDTO = { sasUrl: '/files/unknown.xyz' };
        const result = normalizeAttachment(attachment, mockResolveUrl);
        expect(result.kind).toBe('file');
    });

    it('should handle null/undefined url', () => {
        const attachment: AttachmentDTO = { fileName: 'test.txt' };
        const result = normalizeAttachment(attachment, mockResolveUrl);
        expect(result.url).toBe('');
        expect(result.imageUrl).toBeUndefined();
    });
});

describe('normalizeHistoryPayload', () => {
    const mockResolveUrl = (url: string | undefined): string | undefined => url;

    it('should handle standard backend response format', () => {
        const payload: HistoryDTO = {
            conversationId: 'conv-123',
            messages: [
                { content: 'Hello', sentAt: '2024-01-01T10:00:00Z', isFromLead: true },
                { content: 'Hi!', sentAt: '2024-01-01T10:01:00Z', isFromLead: false }
            ]
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.conversationId).toBe('conv-123');
        expect(result.messages).toHaveLength(2);
        expect(result.messages[0]!.content).toBe('Hello');
        expect(result.messages[0]!.isFromLead).toBe(true);
        expect(result.messages[1]!.isFromLead).toBe(false);
    });

    it('should sort messages by UTC time', () => {
        const payload: HistoryDTO = {
            conversationId: 'conv-123',
            messages: [
                { content: 'Second', sentAt: '2024-01-01T12:00:00Z', isFromLead: true },
                { content: 'First', sentAt: '2024-01-01T10:00:00Z', isFromLead: false },
                { content: 'Third', sentAt: '2024-01-01T14:00:00Z', isFromLead: true }
            ]
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.messages[0]!.content).toBe('First');
        expect(result.messages[1]!.content).toBe('Second');
        expect(result.messages[2]!.content).toBe('Third');
    });

    it('should handle messages with attachments', () => {
        const payload: HistoryDTO = {
            conversationId: 'conv-123',
            messages: [
                {
                    content: 'See attached',
                    sentAt: '2024-01-01T10:00:00Z',
                    isFromLead: true,
                    attachments: [
                        { sasUrl: '/secure/file.pdf', fileName: 'doc.pdf', contentType: 'application/pdf' }
                    ]
                }
            ]
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.messages[0]!.attachments).toHaveLength(1);
        expect(result.messages[0]!.attachments[0]!.fileName).toBe('doc.pdf');
    });

    it('should handle empty messages array', () => {
        const payload: HistoryDTO = {
            conversationId: 'conv-123',
            messages: []
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.conversationId).toBe('conv-123');
        expect(result.messages).toEqual([]);
    });

    it('should handle null payload', () => {
        const result = normalizeHistoryPayload(null as unknown as HistoryDTO, mockResolveUrl);
        expect(result.conversationId).toBeNull();
        expect(result.messages).toEqual([]);
    });

    it('should handle undefined payload', () => {
        const result = normalizeHistoryPayload(undefined as unknown as HistoryDTO, mockResolveUrl);
        expect(result.conversationId).toBeNull();
        expect(result.messages).toEqual([]);
    });

    it('should convert numeric conversationId to string', () => {
        const payload = {
            conversationId: 12345,
            messages: []
        };

        const result = normalizeHistoryPayload(payload as HistoryDTO, mockResolveUrl);
        expect(result.conversationId).toBe('12345');
    });

    it('should handle empty string conversationId as null', () => {
        const payload = {
            conversationId: '',
            messages: []
        };

        const result = normalizeHistoryPayload(payload as HistoryDTO, mockResolveUrl);
        expect(result.conversationId).toBeNull();
    });

    it('should normalize nested content objects', () => {
        const payload: HistoryDTO = {
            conversationId: 'conv-123',
            messages: [
                {
                    content: { content: 'Nested text' },
                    sentAt: '2024-01-01T10:00:00Z',
                    isFromLead: true
                }
            ]
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.messages[0]!.content).toBe('Nested text');
    });

    it('should stringify object content that cannot be extracted', () => {
        const payload: HistoryDTO = {
            conversationId: 'conv-123',
            messages: [
                {
                    content: { foo: 'bar' },
                    sentAt: '2024-01-01T10:00:00Z',
                    isFromLead: true
                }
            ]
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.messages[0]!.content).toBe('{"foo":"bar"}');
    });
});
