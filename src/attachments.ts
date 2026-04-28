/**
 * attachments.ts
 *
 * Attachment domain: constants, MIME maps, and pure helper functions.
 * No DOM access, no UI state, no side effects.
 */

import type { AttachmentDTO, AttachmentKind, PendingAttachment } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** MIME types considered images for display purposes. */
export const IMAGE_CONTENT_TYPES = new Set<string>([
    'image/jpeg',
    'image/png'
]);

/** Maps file extensions to their canonical MIME types. */
export const FILE_EXTENSION_CONTENT_TYPES: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain'
};

/** Set of file extensions the widget accepts. */
export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set<string>([
    '.pdf',
    '.jpg',
    '.jpeg',
    '.png',
    '.docx',
    '.xls',
    '.xlsx',
    '.txt'
]);

/** Accept string for the hidden file input element. */
export const FILE_INPUT_ACCEPT = Array.from(ALLOWED_ATTACHMENT_EXTENSIONS).join(',');

/** Maps pasted image MIME types to their file extension for generated filenames. */
export const PASTED_IMAGE_EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png'
};

/** Attachment kind identifiers. */
export const FILE_KIND_IMAGE: AttachmentKind = 'image';
export const FILE_KIND_PDF: AttachmentKind = 'pdf';
export const FILE_KIND_GENERIC: AttachmentKind = 'file';

/** Maximum allowed attachment size in bytes (5 MB). */
export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Match window (ms) used by the pending-send deduplication engine.
 * A SignalR echo arriving within this window of the client send time
 * is considered a duplicate of the optimistic message.
 */
export const PENDING_SEND_MATCH_WINDOW_MS = 15000;

/**
 * TTL (ms) for resolved pending-send records before they are pruned.
 * Must be >= PENDING_SEND_MATCH_WINDOW_MS to guarantee the double-send guard
 * remains active for the full matching window after resolution.
 */
export const RESOLVED_PENDING_SEND_TTL_MS = 15000;

/** User-facing validation messages (Spanish). */
export const ATTACHMENT_VALIDATION_MESSAGES = {
    unsupportedType: 'Solo se permiten imágenes y documentos compatibles.',
    oversized: 'Puedes adjuntar archivos de hasta 5 MB.',
    unreadableClipboard: 'No se pudo leer uno de los archivos pegados.',
    intakeFailure: 'No se pudo preparar uno de los archivos adjuntos.',
    mixed: 'Algunos archivos no se pudieron adjuntar. Verifica el tamaño e inténtalo de nuevo.'
};

// ============================================================================
// Pure helpers
// ============================================================================

/**
 * Generates a filename for a clipboard-pasted image that has no name.
 */
export function createPastedImageName(contentType: string): string {
    const extension = PASTED_IMAGE_EXTENSIONS[contentType] ?? 'png';
    return `imagen-pegada-${Date.now()}.${extension}`;
}

/**
 * Ensures a File object has a meaningful name.
 * Clipboard-pasted images often arrive without one.
 */
export function ensurePastedImageName(file: File | null): File | null {
    if (!file || file.name) return file;

    const fileName = createPastedImageName(file.type);
    return new File([file], fileName, {
        type: file.type,
        lastModified: file.lastModified || Date.now()
    });
}

/**
 * Extracts File objects from a ClipboardData object, naming unnamed pasted images.
 */
export function extractPastedFiles(clipboardData: DataTransfer | null): File[] {
    if (!clipboardData) return [];

    const files: File[] = [];
    
    if (clipboardData.items?.length) {
        Array.from(clipboardData.items).forEach((item) => {
            if (item.kind !== 'file') return;
            const file = item.getAsFile();
            if (file) files.push(ensurePastedImageName(file)!);
        });
        return files;
    }

    if (clipboardData.files?.length) {
        Array.from(clipboardData.files).forEach((file) => {
            if (file) files.push(ensurePastedImageName(file)!);
        });
    }

    return files;
}

/**
 * Returns the filename without its extension (for display purposes).
 * e.g., "documento.pdf" → "documento", "archivo" → "archivo"
 */
export function getDisplayName(fileName: string): string {
    const normalizedName = String(fileName ?? '').trim();
    const dotIndex = normalizedName.lastIndexOf('.');

    if (dotIndex <= 0) return normalizedName || 'Archivo';

    return normalizedName.slice(0, dotIndex) || normalizedName;
}

/**
 * Extracts the lowercase file extension (including the dot) from a filename.
 */
export function getFileExtension(fileName: string): string {
    const normalizedName = String(fileName ?? '').trim().toLowerCase();
    const dotIndex = normalizedName.lastIndexOf('.');

    if (dotIndex <= 0) return '';

    return normalizedName.slice(dotIndex);
}

/**
 * Returns true if the file's extension or MIME type is in the allowed set.
 */
export function isAllowedAttachmentFile(file: File | null | undefined): boolean {
    const extension = getFileExtension(file?.name ?? '');
    if (extension) {
        return ALLOWED_ATTACHMENT_EXTENSIONS.has(extension);
    }

    return IMAGE_CONTENT_TYPES.has(String(file?.type ?? '').toLowerCase());
}

/**
 * Determines the display kind of an attachment (image, pdf, or generic file).
 */
export function getAttachmentKind(attachment: AttachmentDTO): AttachmentKind {
    const contentType = attachment.contentType ?? '';

    if (IMAGE_CONTENT_TYPES.has(contentType)) return FILE_KIND_IMAGE;
    if (contentType === 'application/pdf') return FILE_KIND_PDF;

    return FILE_KIND_GENERIC;
}

/**
 * Creates a pending attachment object for a file selected by the user,
 * including a temporary blob URL for preview.
 */
export function createPendingAttachment(file: File): PendingAttachment {
    const fileName = file.name || 'Archivo';
    const contentType = file.type;

    return {
        id: `${Date.now()}${Math.random().toString(36).slice(2)}`,
        file,
        fileName,
        contentType,
        kind: getAttachmentKind({ contentType, fileName }),
        localUrl: URL.createObjectURL(file),
        url: '', // Will be set when uploaded
        temp: true
    };
}
