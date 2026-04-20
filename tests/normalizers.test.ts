/**
 * normalizers.test.ts
 *
 * Tests for backend DTO normalization functions.
 */

import { normalizeAttachment, normalizeHistoryPayload } from '../src/normalizers';
import type { AttachmentDTO, HistoryDTO } from '../src/types';

describe('normalizeAttachment', () => {
    const mockResolveUrl = (url: string | undefined): string | undefined => 
        url ? `https://api.example.com${url}` : url;

    it('should normalize camelCase fields', () => {
        const attachment: AttachmentDTO = {
            url: '/files/doc.pdf',
            fileName: 'document.pdf',
            contentType: 'application/pdf'
        };

        const result = normalizeAttachment(attachment, mockResolveUrl);

        expect(result.url).toBe('https://api.example.com/files/doc.pdf');
        expect(result.fileName).toBe('document.pdf');
        expect(result.contentType).toBe('application/pdf');
        expect(result.kind).toBe('pdf');
    });

    it('should normalize PascalCase fields', () => {
        const attachment: AttachmentDTO = {
            Url: '/files/image.png',
            FileName: 'photo.png',
            ContentType: 'image/png'
        };

        const result = normalizeAttachment(attachment, mockResolveUrl);

        expect(result.url).toBe('https://api.example.com/files/image.png');
        expect(result.fileName).toBe('photo.png');
        expect(result.kind).toBe('image');
    });

    it('should prefer sasUrl over url', () => {
        const attachment: AttachmentDTO = {
            sasUrl: '/secure/file.pdf',
            url: '/public/file.pdf',
            fileName: 'file.pdf'
        };

        const result = normalizeAttachment(attachment, mockResolveUrl);

        expect(result.url).toBe('https://api.example.com/secure/file.pdf');
    });

    it('should handle imageUrl for images', () => {
        const attachment: AttachmentDTO = {
            url: '/files/photo.jpg',
            imageUrl: '/thumbs/photo.jpg',
            fileName: 'photo.jpg',
            contentType: 'image/jpeg'
        };

        const result = normalizeAttachment(attachment, mockResolveUrl);

        expect(result.url).toBe('https://api.example.com/files/photo.jpg');
        expect(result.imageUrl).toBe('https://api.example.com/thumbs/photo.jpg');
    });

    it('should default fileName to "Archivo"', () => {
        const attachment: AttachmentDTO = { url: '/files/unknown' };
        const result = normalizeAttachment(attachment, mockResolveUrl);
        expect(result.fileName).toBe('Archivo');
    });

    it('should infer content type from extension', () => {
        const attachment: AttachmentDTO = { url: '/files/doc.pdf' };
        const result = normalizeAttachment(attachment, mockResolveUrl);
        expect(result.contentType).toBe('application/pdf');
        expect(result.kind).toBe('pdf');
    });

    it('should handle unknown types as generic file', () => {
        const attachment: AttachmentDTO = { url: '/files/unknown.xyz' };
        const result = normalizeAttachment(attachment, mockResolveUrl);
        expect(result.kind).toBe('file');
    });

    it('should handle null/undefined url', () => {
        const attachment: AttachmentDTO = { fileName: 'test.txt' };
        const result = normalizeAttachment(attachment, mockResolveUrl);
        // When url is undefined, resolveUrl returns undefined, so url becomes empty string
        expect(result.url).toBe('');
        expect(result.imageUrl).toBeUndefined();
    });
});

describe('normalizeHistoryPayload', () => {
    const mockResolveUrl = (url: string | undefined): string | undefined => url;

    it('should handle raw array of messages', () => {
        const payload: HistoryDTO = [
            { content: 'Hello', sentAt: '2024-01-01T10:00:00Z', isFromLead: true },
            { content: 'Hi!', sentAt: '2024-01-01T10:01:00Z', isFromLead: false }
        ];

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.conversationId).toBeNull();
        expect(result.messages).toHaveLength(2);
        expect(result.messages[0]!.content).toBe('Hello');
        expect(result.messages[0]!.isFromLead).toBe(true);
    });

    it('should handle nested conversation object', () => {
        const payload: HistoryDTO = {
            conversation: {
                conversationId: 'conv-123',
                messages: [
                    { content: 'Test', sentAt: '2024-01-01T10:00:00Z', isFromLead: true }
                ]
            }
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.conversationId).toBe('conv-123');
        expect(result.messages).toHaveLength(1);
    });

    it('should handle PascalCase conversation', () => {
        const payload: HistoryDTO = {
            Conversation: {
                ConversationId: 'conv-456',
                Messages: [
                    { Content: 'Test', SentAt: '2024-01-01T10:00:00Z', IsFromLead: false }
                ]
            }
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.conversationId).toBe('conv-456');
        expect(result.messages[0]!.content).toBe('Test');
        expect(result.messages[0]!.isFromLead).toBe(false);
    });

    it('should handle flat object with messages at root', () => {
        const payload: HistoryDTO = {
            conversationId: 'conv-789',
            messages: [
                { content: 'Flat', sentAt: '2024-01-01T10:00:00Z', isFromLead: true }
            ]
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.conversationId).toBe('conv-789');
        expect(result.messages).toHaveLength(1);
    });

    it('should normalize message content objects', () => {
        const payload: HistoryDTO = [{
            content: { content: 'Nested text' },
            sentAt: '2024-01-01T10:00:00Z',
            isFromLead: true
        }];

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.messages[0]!.content).toBe('Nested text');
    });

    it('should handle object content that cannot be extracted', () => {
        const payload: HistoryDTO = [{
            content: { foo: 'bar' },
            sentAt: '2024-01-01T10:00:00Z',
            isFromLead: true
        }];

        const result = normalizeHistoryPayload(payload, mockResolveUrl);

        expect(result.messages[0]!.content).toBe('{"foo":"bar"}');
    });

    it('should handle empty payload', () => {
        const result = normalizeHistoryPayload(null as unknown as HistoryDTO, mockResolveUrl);
        expect(result.conversationId).toBeNull();
        expect(result.messages).toEqual([]);
    });

    it('should convert conversationId to string', () => {
        const payload: HistoryDTO = {
            conversation: {
                conversationId: 12345,
                messages: []
            }
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);
        expect(result.conversationId).toBe('12345');
        expect(typeof result.conversationId).toBe('string');
    });

    it('should handle empty string conversationId as null', () => {
        const payload: HistoryDTO = {
            conversation: {
                conversationId: '',
                messages: []
            }
        };

        const result = normalizeHistoryPayload(payload, mockResolveUrl);
        expect(result.conversationId).toBeNull();
    });
});
