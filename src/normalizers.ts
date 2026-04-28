/**
 * normalizers.ts
 *
 * DTO normalization for backend payloads.
 * Backend contract: consistent camelCase from Rame API.
 */

import type { 
    Attachment, 
    AttachmentDTO, 
    Message, 
    MessageDTO, 
    HistoryPayload, 
    HistoryDTO,
    ApiSendResponse 
} from './types.js';
import { getAttachmentKind, FILE_EXTENSION_CONTENT_TYPES } from './attachments.js';
import { compareUtcDates } from './utils.js';

/**
 * Internal helper to look up a MIME type from a filename extension.
 */
function inferContentType(fileName: string | undefined, fallback: string): string {
    if (!fileName) return fallback;
    const dot = fileName.lastIndexOf('.');
    if (dot === -1 || dot === fileName.length - 1) return fallback;
    const ext = fileName.slice(dot).toLowerCase();
    return FILE_EXTENSION_CONTENT_TYPES[ext] ?? fallback;
}

/**
 * Normalizes a backend attachment DTO.
 * Backend sends: { sasUrl, fileName, contentType }
 */
export function normalizeAttachment(
    attachment: AttachmentDTO,
    resolveUrl: (url: string | undefined) => string | undefined
): Attachment {
    // Backend usa sasUrl para URLs firmadas, o url para URLs públicas
    const rawUrl = attachment.sasUrl ?? attachment.url;
    const url = resolveUrl(rawUrl) ?? '';
    
    // Infer content type from explicit contentType, then filename, then URL path
    const contentType = attachment.contentType
        || inferContentType(attachment.fileName, '')
        || inferContentType(rawUrl, '');
    const fileName = attachment.fileName ?? 'Archivo';
    
    return {
        url,
        imageUrl: undefined,
        fileName,
        contentType: contentType,
        kind: getAttachmentKind({ contentType: contentType, fileName, sasUrl: url })
    };
}

/**
 * Normalizes a single message DTO.
 * Backend sends: { content, sentAt, isFromLead, attachments }
 */
function normalizeMessage(
    message: MessageDTO,
    resolveUrl: (url: string | undefined) => string | undefined
): Message {
    // Content puede venir como string u objeto
    let content = '';
    const rawContent = message.content ?? message.Content;
    if (typeof rawContent === 'string') {
        content = rawContent;
    } else if (rawContent && typeof rawContent === 'object') {
        const contentObj = rawContent as { content?: string; Content?: string };
        content = contentObj.content ?? contentObj.Content ?? JSON.stringify(rawContent);
    }

    // sentAt es UTC ISO string del backend
    const sentAt = message.sentAt ?? message.SentAt ?? new Date().toISOString();
    const isFromLead = message.isFromLead ?? message.IsFromLead ?? false;
    
    // Attachments array
    const rawAttachments = message.attachments ?? message.Attachments ?? [];
    const attachments = Array.isArray(rawAttachments)
        ? rawAttachments.map(a => normalizeAttachment(a, resolveUrl))
        : [];

    return { content, sentAt, isFromLead, attachments };
}

/**
 * Normalizes the history payload from GET /api/widget/conversations/history
 * Backend response: { conversationId, messages: [...] }
 */
export function normalizeHistoryPayload(
    payload: HistoryDTO | undefined | null,
    resolveUrl: (url: string | undefined) => string | undefined
): HistoryPayload {
    if (!payload) {
        return { conversationId: null, messages: [] };
    }

    // Backend devuelve objeto plano: { conversationId, messages }
    const data = payload as { conversationId?: string | number; messages?: MessageDTO[] };
    
    const rawConversationId = data.conversationId;
    const conversationId = rawConversationId != null && rawConversationId !== '' 
        ? String(rawConversationId) 
        : null;
    
    const rawMessages = data.messages ?? [];
    const messages = Array.isArray(rawMessages)
        ? rawMessages.map(m => normalizeMessage(m, resolveUrl))
            .sort((a, b) => compareUtcDates(a.sentAt, b.sentAt))
        : [];

    return { conversationId, messages };
}

/**
 * Normalizes the send message API response.
 * Backend sends: { conversationId, sentAt, attachments }
 */
export function normalizeSendResponse(
    response: Record<string, unknown> | undefined
): ApiSendResponse {
    if (!response) return {};

    const conversationId = response.conversationId ?? response.ConversationId;
    const sentAt = response.sentAt ?? response.SentAt;
    const attachments = response.attachments ?? response.Attachments;

    return {
        conversationId: typeof conversationId === 'string' ? conversationId : undefined,
        SentAt: typeof sentAt === 'string' ? sentAt : undefined,
        Attachments: Array.isArray(attachments) ? attachments as AttachmentDTO[] : undefined
    };
}
