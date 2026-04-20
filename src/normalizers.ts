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
import { inferAttachmentContentType, getAttachmentKind } from './attachments.js';
import { compareUtcDates } from './utils.js';

/**
 * Normalizes a backend attachment DTO.
 * Backend sends: { sasUrl, fileName, contentType }
 */
export function normalizeAttachment(
    attachment: AttachmentDTO,
    resolveUrl: (url: string | undefined) => string | undefined
): Attachment {
    // Backend usa sasUrl para URLs firmadas, o url para URLs públicas
    const rawUrl = attachment.sasUrl ?? attachment.SasUrl ?? attachment.url ?? attachment.Url;
    const url = resolveUrl(rawUrl) ?? '';
    const contentType = attachment.contentType ?? attachment.ContentType ?? '';
    const fileName = attachment.fileName ?? attachment.FileName ?? attachment.name ?? attachment.Name ?? 'Archivo';

    // Infer content type from fileName/URL if not explicitly provided
    const finalContentType = contentType || inferAttachmentContentType(attachment);

    return {
        url,
        imageUrl: undefined,
        fileName,
        contentType: finalContentType,
        kind: getAttachmentKind({ contentType: finalContentType, fileName, url })
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
