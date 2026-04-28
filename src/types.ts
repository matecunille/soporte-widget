/**
 * types.ts
 *
 * Central type definitions for the Soporte Widget.
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface WidgetCredentials {
    userName: string;
    password: string;
}

export interface WidgetConfig {
    apiUrl: string;
    clientId: string;
    title: string;
    subtitle: string;
    primaryColor: string;
    position: 'left' | 'right';
    senderIdentifier: string;
    credentials: WidgetCredentials | null;
    senderCompany: string;
    welcomeMessage: string;
    avatarImage: string;
    avatarLetter: string;
    agentName: string;
    soundEnabled: boolean;
    zIndex: number;
    productName: string;
}

export type UserConfig = Partial<WidgetConfig>;

// ============================================================================
// Attachment Types
// ============================================================================

export type AttachmentKind = 'image' | 'pdf' | 'file';

export interface Attachment {
    url: string;
    imageUrl?: string;
    fileName: string;
    contentType: string;
    kind: AttachmentKind;
    temp?: boolean;
}

export interface PendingAttachment extends Attachment {
    id: string;
    file: File;
    localUrl: string;
}

// Backend DTO with camelCase or PascalCase variants
export interface AttachmentDTO {
    sasUrl?: string;
    url?: string;
    fileName?: string;
    contentType?: string;
    localUrl?: string;
}

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
    id?: string;
    content: string;
    sentAt: string;
    isFromLead: boolean;
    attachments: Attachment[];
    _blobUrls?: string[];
    failed?: boolean;
}

export interface OptimisticMessage extends Message {
    id: string;
    _blobUrls: string[];
}

// Backend DTO with camelCase or PascalCase variants
export interface MessageDTO {
    content?: unknown;
    Content?: unknown;
    sentAt?: string;
    SentAt?: string;
    isFromLead?: boolean;
    IsFromLead?: boolean;
    attachments?: AttachmentDTO[];
    Attachments?: AttachmentDTO[];
}

// ============================================================================
// History Types
// ============================================================================

export interface HistoryPayload {
    conversationId: string | null;
    messages: Message[];
}

export interface ConversationDTO {
    conversationId?: string | number;
    ConversationId?: string | number;
    id?: string | number;
    Id?: string | number;
    messages?: MessageDTO[];
    Messages?: MessageDTO[];
}

export type HistoryDTO =
    | MessageDTO[]
    | { conversation?: ConversationDTO; Conversation?: ConversationDTO; messages?: MessageDTO[]; Messages?: MessageDTO[] }
    | ConversationDTO;

// ============================================================================
// API Types
// ============================================================================

export interface ApiSendResponse {
    conversationId?: string;
    ConversationId?: string;
    sentAt?: string;
    SentAt?: string;
    attachments?: AttachmentDTO[];
    Attachments?: AttachmentDTO[];
}

export interface AuthState {
    token: string | null;
    expiresAt: number;
    userName: string | null;
    password: string | null;
}

// ============================================================================
// SignalR Types
// ============================================================================

export type SignalRStatus = 'connected' | 'connecting' | 'disconnected';

export interface SignalRCallbacks {
    onMessage: (content: string, sentAt: string, attachments: AttachmentDTO[], isFromLead: boolean) => void;
    onStatusChange: (status: SignalRStatus) => void;
}

// ============================================================================
// Event Types
// ============================================================================

export type WidgetEvent = 
    | 'open' 
    | 'close' 
    | 'message' 
    | 'credentialsSet' 
    | 'userSet'
    | 'historyError'
    | 'connectionError'
    | 'sendError';

export interface WidgetEventMap {
    open: void;
    close: void;
    message: { content: string; sentAt: string; isFromLead: boolean };
    credentialsSet: { senderIdentifier: string };
    userSet: { userName: string; empresa: string };
    historyError: { error: string };
    connectionError: { error: string };
    sendError: { error: string; tempId: string };
}

export type WidgetEventCallback<T extends WidgetEvent> = (data: WidgetEventMap[T]) => void;

// ============================================================================
// Pending Send Types
// ============================================================================

export type PendingSendStatus = 'active' | 'resolved' | 'failed';

export interface PendingSendEntry {
    tempId: string;
    sentAt: string;
    content: string;
    attachmentFingerprint: string;
    looseAttachmentFingerprint: string;
    status: PendingSendStatus;
    resolvedAt: number | null;
}

// ============================================================================
// Error Types
// ============================================================================

export interface WidgetError extends Error {
    code?: string;
    recoverable?: boolean;
}

export type AttachmentValidationError = 
    | 'unsupportedType' 
    | 'oversized' 
    | 'unreadableClipboard' 
    | 'intakeFailure' 
    | 'mixed';

export interface AttachmentValidationErrors {
    unsupportedType: boolean;
    oversized: boolean;
    unreadableClipboard: boolean;
    intakeFailure: boolean;
}

// ============================================================================
// Viewport Types
// ============================================================================

export interface ViewportContext {
    isOpen: boolean;
    shadowRoot: ShadowRoot | null;
    inputEl: HTMLInputElement | null;
}

// ============================================================================
// Global Window Types
// ============================================================================

declare global {
    interface Window {
        SoporteWidgetConfig?: UserConfig;
        initSoporteWidget?: () => void;
        SoporteWidget?: {
            open: () => void;
            close: () => void;
            toggle: () => void;
            destroy: () => void;
            on: <T extends WidgetEvent>(event: T, callback: WidgetEventCallback<T>) => void;
            setUser: (userName: string, empresa: string) => void;
            setCredentials: (userName: string, password: string, senderIdentifier: string) => void;
        };
    }
}

export {};
