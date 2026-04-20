/**
 * normalizers.ts
 *
 * Pure DTO normalization functions for backend payloads.
 * No DOM access, no side effects, no UI dependencies.
 *
 * Accepts camelCase and PascalCase variants from the backend
 * (e.g. content/Content, messages/Messages) — preserve this tolerance.
 */

import type { 
    Attachment, 
    AttachmentDTO, 
    Message, 
    MessageDTO, 
    HistoryPayload, 
    HistoryDTO,
    ConversationDTO 
} from './types.js';
import { inferAttachmentContentType, getAttachmentKind } from './attachments.js';

/**
 * Normalizes a raw attachment DTO from the backend into a consistent shape.
 */
export function normalizeAttachment(
    attachment: AttachmentDTO,
    resolveUrl: (url: string | undefined) => string | undefined
): Attachment {
    const rawUrl = (
        attachment.sasUrl ??
        attachment.SasUrl ??
        attachment.url ??
        attachment.Url ??
        attachment.localUrl ??
        attachment.imageUrl ??
        attachment.ImageUrl
    );
    const rawImageUrl = attachment.imageUrl ?? attachment.ImageUrl ?? rawUrl;
    const url = resolveUrl(rawUrl);
    const imageUrl = rawImageUrl ? resolveUrl(rawImageUrl) : url;
    const contentType = inferAttachmentContentType(attachment);
    const fileName = attachment.fileName ?? attachment.FileName ?? attachment.name ?? attachment.Name ?? 'Archivo';

    return {
        url: url ?? '',
        imageUrl,
        fileName,
        contentType,
        kind: getAttachmentKind({ ...attachment, contentType, fileName, url, imageUrl })
    };
}

/**
 * Normalizes a single history message DTO.
 */
function normalizeHistoryMessage(
    message: MessageDTO,
    resolveUrl: (url: string | undefined) => string | undefined
): Message {
    let content: string = message.content as string ?? message.Content as string ?? '';
    
    if (typeof content === 'object' && content !== null) {
        const contentObj = content as { content?: string; Content?: string };
        content = contentObj.content ?? contentObj.Content ?? JSON.stringify(content);
    }

    const rawAttachments = Array.isArray(message.attachments)
        ? message.attachments
        : Array.isArray(message.Attachments)
            ? message.Attachments
            : [];
    const attachments = rawAttachments.map((attachment) => normalizeAttachment(attachment, resolveUrl));

    return {
        content: String(content),
        sentAt: message.sentAt ?? message.SentAt ?? new Date().toISOString(),
        isFromLead: message.isFromLead ?? message.IsFromLead ?? false,
        attachments
    };
}

/**
 * Normalizes the full history payload returned by the backend.
 * Accepts multiple payload shapes:
 *   - Raw array of messages
 *   - { conversation: { messages: [...] }, ... }
 *   - Flat object with messages/Messages at the root
 */
export function normalizeHistoryPayload(
    payload: HistoryDTO | undefined | null,
    resolveUrl: (url: string | undefined) => string | undefined
): HistoryPayload {
    const history = payload ?? [];
    
    const isArray = Array.isArray(history);
    const conversation = isArray
        ? null
        : (history as { conversation?: ConversationDTO; Conversation?: ConversationDTO }).conversation 
            ?? (history as { conversation?: ConversationDTO; Conversation?: ConversationDTO }).Conversation 
            ?? (history as ConversationDTO);
    
    const rawMessages = isArray
        ? (history as MessageDTO[])
        : [
            conversation?.messages,
            conversation?.Messages,
            (history as { messages?: MessageDTO[] }).messages,
            (history as { Messages?: MessageDTO[] }).Messages
        ].find(Array.isArray) ?? [];
    
    const rawConversationId =
        conversation?.conversationId ??
        conversation?.ConversationId ??
        conversation?.id ??
        conversation?.Id ??
        (history as { conversationId?: string | number }).conversationId ??
        (history as { ConversationId?: string | number }).ConversationId ??
        (history as { id?: string | number }).id ??
        (history as { Id?: string | number }).Id ??
        null;

    // Normalize and sort messages chronologically (oldest first)
    const normalizedMessages = (rawMessages as MessageDTO[])
        .map((message) => normalizeHistoryMessage(message, resolveUrl))
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    return {
        conversationId: rawConversationId == null || rawConversationId === '' 
            ? null 
            : String(rawConversationId),
        messages: normalizedMessages
    };
}
