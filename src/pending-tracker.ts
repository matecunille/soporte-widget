/**
 * pending-tracker.ts
 *
 * PendingTracker — optimistic message deduplication engine.
 *
 * When the user sends a message, the widget immediately renders it optimistically.
 * The backend then echoes that message back through SignalR. PendingTracker tracks
 * in-flight sends so the SignalR echo can be reconciled with the existing optimistic
 * entry instead of rendering it twice.
 *
 * No DOM access. No UI dependencies. Fully independent and independently testable.
 */

import type { PendingSendEntry, PendingSendStatus, Attachment } from './types.js';
import { getAttachmentKind, RESOLVED_PENDING_SEND_TTL_MS, PENDING_SEND_MATCH_WINDOW_MS } from './attachments.js';

export class PendingTracker {
    private entries: PendingSendEntry[] = [];
    private sequence = 0;

    /**
     * Creates a unique temp ID for an optimistic message.
     */
    createTempId(): string {
        this.sequence += 1;
        return `pending-send-${Date.now()}-${this.sequence}`;
    }

    /**
     * Registers a new in-flight send. Call immediately after sending.
     */
    register(
        tempId: string,
        sentAt: string,
        content: string,
        attachments: Attachment[] | PendingAttachment[]
    ): void {
        this.entries.push(this.createEntry(tempId, sentAt, content, attachments));
        this.prune();
    }

    /**
     * Finds the oldest unresolved pending send that matches the given message
     * content, attachments, and sent time. Used to reconcile a SignalR echo.
     */
    findUnresolved(
        content: string,
        attachments: Attachment[],
        sentAt: string | undefined
    ): PendingSendEntry | null {
        return this.findMatch('active', content, attachments, sentAt);
    }

    /**
     * Finds an already-resolved pending send matching the given message.
     * Used to suppress double-render when the SignalR echo arrives after
     * the send response has already reconciled the optimistic message.
     */
    findResolved(
        content: string,
        attachments: Attachment[],
        sentAt: string | undefined
    ): PendingSendEntry | null {
        return this.findMatch('resolved', content, attachments, sentAt);
    }

    /**
     * Direct tempId lookup — used in the send response reconciliation path.
     */
    findByTempId(tempId: string): PendingSendEntry | null {
        return this.entries.find((entry) => entry.tempId === tempId) ?? null;
    }

    /**
     * Marks a pending send as resolved (successfully echoed back from SignalR).
     * Schedules a delayed prune to keep the entry available for the double-send guard.
     */
    resolve(entry: PendingSendEntry): boolean {
        if (!entry || entry.status !== 'active') return false;

        entry.status = 'resolved';
        entry.resolvedAt = Date.now();
        this.prune();
        window.setTimeout(() => this.prune(), RESOLVED_PENDING_SEND_TTL_MS + 50);
        return true;
    }

    /**
     * Marks a pending send as failed (API error on the send path).
     */
    markFailed(tempId: string): boolean {
        const entry = this.entries.find((e) => e.tempId === tempId);
        if (!entry || entry.status !== 'active') return false;

        entry.status = 'failed';
        entry.resolvedAt = Date.now();
        this.prune();
        return true;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private normalizeContent(content: string | unknown): string {
        return typeof content === 'string' ? content.trim() : '';
    }

    /**
     * Creates a precise fingerprint using filename + contentType + kind.
     */
    private exactFingerprint(attachments: Attachment[]): string {
        const list = Array.isArray(attachments) ? attachments : [];
        return list.map((a, i) => {
            const fileName = a?.fileName ?? 'Archivo';
            const contentType = a?.contentType ?? '';
            const kind = a?.kind ?? getAttachmentKind({ fileName, contentType });
            return `${list.length}:${i}:${fileName}:${contentType}:${kind}`;
        }).join('|');
    }

    /**
     * Creates a loose fingerprint using only contentType + kind (no filename).
     */
    private looseFingerprint(attachments: Attachment[]): string {
        const list = Array.isArray(attachments) ? attachments : [];
        return list.map((a, i) => {
            const contentType = a?.contentType ?? '';
            const kind = a?.kind ?? getAttachmentKind({ contentType });
            return `${list.length}:${i}:${contentType}:${kind}`;
        }).join('|');
    }

    private createEntry(
        tempId: string,
        sentAt: string,
        content: string,
        attachments: Attachment[]
    ): PendingSendEntry {
        const normalizedContent = this.normalizeContent(content);
        return {
            tempId,
            sentAt,
            content: normalizedContent,
            attachmentFingerprint: this.exactFingerprint(attachments),
            looseAttachmentFingerprint: this.looseFingerprint(attachments),
            status: 'active',
            resolvedAt: null
        };
    }

    /**
     * Returns the absolute time delta in ms between an entry's sentAt and a reference time.
     */
    private timeDelta(entry: PendingSendEntry, sentAt: string | undefined): number {
        const pendingTime = new Date(entry.sentAt || 0).getTime();
        const messageTime = sentAt ? new Date(sentAt).getTime() : pendingTime;

        if (!pendingTime || !messageTime) return Number.POSITIVE_INFINITY;

        return Math.abs(pendingTime - messageTime);
    }

    /**
     * Finds the oldest entry matching the given status, content, attachments, and time.
     */
    private findMatch(
        status: PendingSendStatus,
        content: string,
        attachments: Attachment[],
        sentAt: string | undefined
    ): PendingSendEntry | null {
        const normalizedContent = this.normalizeContent(content);
        const exactFp = this.exactFingerprint(attachments);
        const looseFp = this.looseFingerprint(attachments);

        const byExact = this.entries.filter((e) =>
            e.status === status &&
            e.content === normalizedContent &&
            e.attachmentFingerprint === exactFp
        );

        if (!sentAt) return byExact[0] ?? null;

        const withinWindow = (e: PendingSendEntry) => 
            this.timeDelta(e, sentAt) <= PENDING_SEND_MATCH_WINDOW_MS;
        const byTime = (a: PendingSendEntry, b: PendingSendEntry) => 
            this.timeDelta(a, sentAt) - this.timeDelta(b, sentAt);

        const exactMatch = byExact.filter(withinWindow).sort(byTime)[0] ?? null;
        if (exactMatch) return exactMatch;

        return this.entries
            .filter((e) =>
                e.status === status &&
                e.content === normalizedContent &&
                e.looseAttachmentFingerprint === looseFp &&
                withinWindow(e)
            )
            .sort(byTime)[0] ?? null;
    }

    /** Removes failed entries and expired resolved entries. */
    private prune(now = Date.now()): void {
        this.entries = this.entries.filter((e) => {
            if (e.status === 'active') return true;
            if (e.status === 'failed') return false;
            return e.resolvedAt !== null && now - e.resolvedAt < RESOLVED_PENDING_SEND_TTL_MS;
        });
    }
}

// Import needed for type reference in exactFingerprint/looseFingerprint
import type { PendingAttachment } from './types.js';
