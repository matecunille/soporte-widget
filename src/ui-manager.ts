/**
 * ui-manager.ts
 *
 * Main UI orchestrator with incremental rendering, rate limiting,
 * offline handling, and draft persistence.
 */

import { ApiClient } from './api-client.js';
import { SignalRManager } from './signalr-manager.js';
import { generateStyles, closeIconSvg } from './styles.js';
import { escapeHtml, playNotificationSound, setWidgetCredentials, compareUtcDates } from './utils.js';
import { MessageRenderer, isStartOfNewGroup, isEndOfGroup } from './message-renderer.js';
import {
    createPendingAttachment,
    FILE_KIND_IMAGE,
    FILE_KIND_PDF,
    FILE_INPUT_ACCEPT,
    isAllowedAttachmentFile,
    MAX_ATTACHMENT_SIZE_BYTES,
    extractPastedFiles,
    ATTACHMENT_VALIDATION_MESSAGES,
} from './attachments.js';
import { fileIconSvg } from './styles/icons.js';
import { normalizeAttachment, normalizeHistoryPayload } from './normalizers.js';
import { PendingTracker } from './pending-tracker.js';
import { bindViewportEvents, updateMobileViewportLayout } from './viewport.js';
import { CircuitBreaker, type CircuitState } from './circuit-breaker.js';
import type {
    WidgetConfig,
    Message,
    Attachment,
    AttachmentDTO,
    PendingAttachment,
    SignalRStatus,
    WidgetEvent,
    WidgetEventMap,
    ViewportContext,
    HistoryDTO
} from './types.js';

// Rate limiting constants
const MIN_SEND_INTERVAL_MS = 500;
const DRAFT_STORAGE_KEY = 'soporte-widget-draft';
const DRAFT_DEBOUNCE_MS = 500;

export class UI {
    private readonly cfg: WidgetConfig;
    private readonly api: ApiClient;
    private signalr: SignalRManager | null = null;
    private messages: Message[] = [];
    private isOpen = false;
    private unread = 0;
    private conversationId: string | null = null;
    private senderIdentifier: string;
    private senderCompany: string;
    private connected = false;
    private status: SignalRStatus = 'disconnected';
    private readonly listeners: { [K in WidgetEvent]?: Array<(data: WidgetEventMap[K]) => void> } = {};
    private sending = false;
    private lastSendTime = 0;
    private pendingAttachments: PendingAttachment[] = [];
    private userSet = false;
    private renderer: MessageRenderer;

    // Circuit Breaker for connection management
    private readonly circuitBreaker: CircuitBreaker;
    private signalrReconnectAttempt = 0;

    // Pending send deduplication
    private readonly tracker = new PendingTracker();

    // Viewport management
    private viewportCtx: ViewportContext = { isOpen: false, shadowRoot: null, inputEl: null };
    private scheduleMobileViewportUpdate: ((forceScroll?: boolean) => void) | null = null;
    private unbindViewportEvents: (() => void) | null = null;

    // DOM elements
    private host: HTMLDivElement | null = null;
    private shadow: ShadowRoot | null = null;
    private fab: HTMLButtonElement | null = null;
    private popup: HTMLDivElement | null = null;
    private badge: HTMLSpanElement | null = null;
    private elStatus: HTMLDivElement | null = null;
    private elMessages: HTMLDivElement | null = null;
    private elBody: HTMLDivElement | null = null;
    private elInput: HTMLInputElement | null = null;
    private elSendBtn: HTMLButtonElement | null = null;
    private elFooter: HTMLDivElement | null = null;
    private elAttachBtn: HTMLButtonElement | null = null;
    private elFileInput: HTMLInputElement | null = null;
    private elAttachmentPreview: HTMLDivElement | null = null;
    private elAttachmentValidation: HTMLDivElement | null = null;

    // Draft persistence
    private draftDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(config: WidgetConfig) {
        this.cfg = config;
        this.api = new ApiClient(config);
        this.senderIdentifier = config.senderIdentifier ?? '';
        this.senderCompany = config.senderCompany ?? '';
        this.renderer = new MessageRenderer(config);

        // Initialize Circuit Breaker (3 failures before opening)
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 3,
            onStateChange: (state, failureCount) => {
                this.handleCircuitStateChange(state, failureCount);
            }
        });

        // Auto-initialize credentials
        if (config.credentials?.userName && config.credentials?.password) {
            setWidgetCredentials(config.credentials.userName, config.credentials.password);
        }

        if (this.senderIdentifier) {
            this.userSet = true;
        }

        this.setupOfflineHandling();
        this.buildDOM();
        this.restoreDraft();
    }

    // ========================================================================
    // Offline handling
    // ========================================================================

    private setupOfflineHandling(): void {
        window.addEventListener('online', () => {
            console.log('Widget: Network connection restored');
            
            // Only auto-reconnect if circuit allows it
            if (this.isOpen && this.status === 'disconnected' && !this.circuitBreaker.isOpen()) {
                console.log('[CircuitBreaker] Auto-reconnecting after network restore');
                void this.connect();
            } else if (this.circuitBreaker.isOpen()) {
                console.log('[CircuitBreaker] Network restored but circuit is OPEN - waiting for manual retry');
                // Update UI to show user can now retry
                this.updateConnectionErrorUI();
            }
            
            this.emit('connectionError', { error: 'Network connection restored' } as WidgetEventMap['connectionError']);
        });

        window.addEventListener('offline', () => {
            console.log('Widget: Network connection lost');
            this.status = 'disconnected';
            this.updateStatus();
            this.emit('connectionError', { error: 'Network connection lost' } as WidgetEventMap['connectionError']);
        });
    }

    // ========================================================================
    // DOM construction
    // ========================================================================

    private buildDOM(): void {
        const t = this.cfg;

        this.host = document.createElement('div');
        this.host.id = 'soporte-widget-host';
        this.shadow = this.host.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = generateStyles(t);
        this.shadow.appendChild(style);

        // FAB
        this.fab = document.createElement('button');
        this.fab.className = 'sw-fab';
        this.fab.setAttribute('aria-label', 'Abrir chat de soporte');
        this.fab.innerHTML = `<svg class="sw-icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>${closeIconSvg}<span class="sw-fab-ring"></span><span class="sw-badge"></span>`;
        this.fab.addEventListener('click', () => this.toggle());
        this.shadow.appendChild(this.fab);
        this.badge = this.fab.querySelector('.sw-badge');

        // Popup
        this.popup = document.createElement('div');
        this.popup.className = 'sw-popup';
        this.popup.setAttribute('role', 'dialog');
        this.popup.setAttribute('aria-label', t.title);
        this.popup.innerHTML = `
            <div class="sw-header">
                <div class="sw-header-row">
                    <div class="sw-header-avatar">
                        ${t.avatarImage ? `<img src="${escapeHtml(t.avatarImage)}" alt="${escapeHtml(t.title)}" />` : escapeHtml(t.avatarLetter)}
                        <div class="sw-header-dot"></div>
                    </div>
                    <div class="sw-header-text">
                        <div class="sw-header-title">${escapeHtml(t.title)}</div>
                        <div class="sw-header-subtitle">${escapeHtml(t.subtitle)}</div>
                    </div>
                </div>
                <button class="sw-btn-close" aria-label="Cerrar">${closeIconSvg}</button>
            </div>
            <div class="sw-status hidden"></div>
            <div class="sw-body"><div class="sw-messages"></div></div>
            <div class="sw-attachment-preview" style="display:none;"></div>
            <div class="sw-attachment-validation hidden" aria-live="polite"></div>
            <div class="sw-footer">
                <button class="sw-attach-btn" aria-label="Adjuntar archivo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-8.49 8.49a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.48-8.48"/></svg></button>
                <input class="sw-input" type="text" placeholder="Escribe un mensaje…" aria-label="Mensaje" />
                <button class="sw-send-btn" aria-label="Enviar" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
            </div>
            <input class="sw-file-input" type="file" accept="${FILE_INPUT_ACCEPT}" multiple style="display:none;" />
            <div class="sw-powered">Powered by <a href="#">DPS</a></div>
        `;
        this.shadow.appendChild(this.popup);

        // Cache DOM refs
        this.elStatus = this.popup.querySelector('.sw-status');
        this.elMessages = this.popup.querySelector('.sw-messages');
        this.elBody = this.popup.querySelector('.sw-body');
        this.elInput = this.popup.querySelector('.sw-input');
        this.elSendBtn = this.popup.querySelector('.sw-send-btn');
        this.elFooter = this.popup.querySelector('.sw-footer');
        this.elAttachBtn = this.popup.querySelector('.sw-attach-btn');
        this.elFileInput = this.popup.querySelector('.sw-file-input');
        this.elAttachmentPreview = this.popup.querySelector('.sw-attachment-preview');
        this.elAttachmentValidation = this.popup.querySelector('.sw-attachment-validation');

        // Wire events
        this.popup.querySelector('.sw-btn-close')?.addEventListener('click', () => this.close());

        this.elAttachBtn?.addEventListener('click', () => {
            this.elFileInput?.click();
        });

        this.elFileInput?.addEventListener('change', () => {
            const files = this.elFileInput?.files ? Array.from(this.elFileInput.files) : [];
            this.handleAttachmentIntake(files);
            if (this.elFileInput) this.elFileInput.value = '';
        });

        this.elInput?.addEventListener('input', () => {
            this.updateSendButton();
            this.debouncedSaveDraft();
        });

        this.elInput?.addEventListener('focus', () => {
            this.elFooter?.classList.add('focused');
            this.scheduleMobileViewportUpdate?.(true);
        });

        this.elInput?.addEventListener('blur', () => {
            this.elFooter?.classList.remove('focused');
            this.scheduleMobileViewportUpdate?.();
        });

        this.elInput?.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void this.sendMessage();
            }
        });

        this.elSendBtn?.addEventListener('click', () => void this.sendMessage());

        this.elMessages?.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const fileLink = target.closest('.sw-msg-file') as HTMLElement | null;
            if (fileLink) {
                e.preventDefault();
                const url = fileLink.dataset.url;
                const fileName = fileLink.dataset.fileName;
                if (url) void this.downloadAttachment(url, fileName ?? 'archivo');
                return;
            }

            const img = target.closest('.sw-msg-image') as HTMLImageElement | null;
            if (img?.src) this.openLightbox(img.src);
        });

        this.popup.addEventListener('paste', (e: ClipboardEvent) => this.handlePaste(e));

        this.shadow.addEventListener('keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Escape' && this.isOpen) this.close();
        });

        document.body.appendChild(this.host);

        // Bind viewport
        this.viewportCtx = {
            isOpen: this.isOpen,
            shadowRoot: this.shadow,
            inputEl: this.elInput
        };

        const { scheduledUpdate, unbind } = bindViewportEvents(
            this.popup,
            this.viewportCtx,
            () => this.scrollToBottom(true)
        );
        this.scheduleMobileViewportUpdate = scheduledUpdate;
        this.unbindViewportEvents = unbind;

        if (!this.userSet) {
            console.warn('Widget hidden: user not set');
            this.host.style.display = 'none';
        }

        this.renderMessages(true);
    }

    // ========================================================================
    // Draft persistence
    // ========================================================================

    private debouncedSaveDraft(): void {
        if (this.draftDebounceTimer) {
            clearTimeout(this.draftDebounceTimer);
        }
        this.draftDebounceTimer = setTimeout(() => {
            this.saveDraft();
        }, DRAFT_DEBOUNCE_MS);
    }

    private saveDraft(): void {
        if (!this.elInput) return;
        const draft = {
            text: this.elInput.value,
            timestamp: Date.now()
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }

    private restoreDraft(): void {
        try {
            const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (!stored || !this.elInput) return;

            const draft = JSON.parse(stored) as { text: string; timestamp: number };
            const age = Date.now() - draft.timestamp;

            // Only restore drafts less than 24 hours old
            if (age < 24 * 60 * 60 * 1000) {
                this.elInput.value = draft.text;
                this.updateSendButton();
            } else {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
            }
        } catch {
            // Ignore parse errors
        }
    }

    private clearDraft(): void {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    // ========================================================================
    // Send button state
    // ========================================================================

    private updateSendButton(): void {
        if (!this.elSendBtn || !this.elInput) return;
        const hasContent = this.elInput.value.trim().length > 0;
        const hasAttachments = this.pendingAttachments.length > 0;
        this.elSendBtn.disabled = !hasContent && !hasAttachments;
    }

    // ========================================================================
    // Attachment handling
    // ========================================================================

    private handlePaste(event: ClipboardEvent): void {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return;

        const items = Array.from(clipboardData.items ?? []);
        const fileItems = items.filter((item) => item.kind === 'file');
        const hasUnreadable = fileItems.some((item) => !item.getAsFile());
        const pastedFiles = fileItems.length > 0
            ? extractPastedFiles(clipboardData)
            : extractPastedFiles(clipboardData);

        if (pastedFiles.length === 0 && !hasUnreadable) return;

        event.preventDefault();
        this.handleAttachmentIntake(pastedFiles, { hasUnreadableClipboardItem: hasUnreadable });
    }

    private handleFileSelect(file: File): 'added' | 'unsupportedType' | 'oversized' | 'intakeFailure' {
        if (!isAllowedAttachmentFile(file)) return 'unsupportedType';
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) return 'oversized';

        try {
            this.pendingAttachments.push(createPendingAttachment(file));
            return 'added';
        } catch (error) {
            console.warn('Attachment intake error', error);
            return 'intakeFailure';
        }
    }

    private handleAttachmentIntake(
        files: File[],
        options: { hasUnreadableClipboardItem?: boolean } = {}
    ): void {
        const errors = {
            unsupportedType: false,
            oversized: false,
            unreadableClipboard: options.hasUnreadableClipboardItem ?? false,
            intakeFailure: false
        };
        let addedAttachments = false;

        for (const file of files) {
            const result = this.handleFileSelect(file);
            if (result === 'added') {
                addedAttachments = true;
            } else if (result in errors) {
                errors[result as keyof typeof errors] = true;
            }
        }

        if (addedAttachments) {
            this.showAttachmentPreview();
            this.updateSendButton();
        }

        const validationMessage = this.getAttachmentValidationMessage(errors);
        if (validationMessage) {
            this.setAttachmentValidationError(validationMessage);
            return;
        }

        if (addedAttachments) {
            this.clearAttachmentValidationError();
        }
    }

    private getAttachmentValidationMessage(errors: {
        unsupportedType: boolean;
        oversized: boolean;
        unreadableClipboard: boolean;
        intakeFailure: boolean;
    }): string {
        const errorCount = Object.values(errors).filter(Boolean).length;

        if (errorCount > 1) return ATTACHMENT_VALIDATION_MESSAGES.mixed;
        if (errors.unsupportedType) return ATTACHMENT_VALIDATION_MESSAGES.unsupportedType;
        if (errors.intakeFailure) return ATTACHMENT_VALIDATION_MESSAGES.intakeFailure;
        if (errors.unreadableClipboard) return ATTACHMENT_VALIDATION_MESSAGES.unreadableClipboard;
        if (errors.oversized) return ATTACHMENT_VALIDATION_MESSAGES.oversized;

        return '';
    }

    private setAttachmentValidationError(message: string): void {
        if (this.elAttachmentValidation) {
            this.elAttachmentValidation.textContent = message;
            this.elAttachmentValidation.classList.remove('hidden');
        }
    }

    private clearAttachmentValidationError(): void {
        if (this.elAttachmentValidation) {
            this.elAttachmentValidation.textContent = '';
            this.elAttachmentValidation.classList.add('hidden');
        }
    }

    private showAttachmentPreview(): void {
        if (!this.elAttachmentPreview) return;

        if (this.pendingAttachments.length === 0) {
            this.elAttachmentPreview.style.display = 'none';
            this.elAttachmentPreview.innerHTML = '';
            return;
        }

        this.elAttachmentPreview.innerHTML = this.pendingAttachments.map((attachment) => {
            const previewContent = attachment.kind === FILE_KIND_IMAGE
                ? `<img class="sw-attachment-preview-thumb" src="${attachment.localUrl}" />`
                : `
                    <div class="sw-preview-file sw-preview-file-${attachment.kind}">
                        <div class="sw-preview-file-icon">
                            ${attachment.kind === FILE_KIND_PDF ? 'PDF' : fileIconSvg}
                        </div>
                        <div class="sw-preview-file-meta">
                            <div class="sw-preview-file-name">${escapeHtml(attachment.fileName)}</div>
                            <div class="sw-preview-file-type">${attachment.kind === FILE_KIND_PDF ? 'Documento PDF' : 'Archivo'}</div>
                        </div>
                    </div>
                `;

            return `
                <div class="sw-attachment-preview-item" data-id="${attachment.id}">
                    ${previewContent}
                    <button class="sw-attachment-preview-remove" aria-label="Quitar">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        this.elAttachmentPreview.style.display = 'flex';
        this.elAttachmentPreview.querySelectorAll('.sw-attachment-preview-remove').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = (btn.closest('.sw-attachment-preview-item') as HTMLElement | null)?.dataset?.id;
                if (id) this.removePendingAttachment(id);
            });
        });
    }

    private clearPendingAttachments(revoke = true): void {
        if (revoke) {
            this.pendingAttachments.forEach((a) => URL.revokeObjectURL(a.localUrl));
        }
        this.pendingAttachments = [];
        this.clearAttachmentValidationError();
        if (this.elAttachmentPreview) {
            this.elAttachmentPreview.style.display = 'none';
            this.elAttachmentPreview.innerHTML = '';
        }
        this.updateSendButton();
    }

    private removePendingAttachment(id: string): void {
        const idx = this.pendingAttachments.findIndex((a) => a.id === id);
        if (idx !== -1) {
            URL.revokeObjectURL(this.pendingAttachments[idx]!.localUrl);
            this.pendingAttachments.splice(idx, 1);
        }
        if (this.pendingAttachments.length === 0) {
            this.clearAttachmentValidationError();
        }
        this.showAttachmentPreview();
        this.updateSendButton();
    }

    private openLightbox(src: string): void {
        if (!this.shadow) return;
        const lightbox = document.createElement('div');
        lightbox.className = 'sw-lightbox';
        lightbox.innerHTML = `<img src="${src}" />`;
        lightbox.addEventListener('click', () => lightbox.remove());
        this.shadow.appendChild(lightbox);
    }

    private async downloadAttachment(url: string, fileName: string): Promise<void> {
        if (!url) return;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        } catch (error) {
            console.warn('Attachment download fallback', error);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.rel = 'noopener noreferrer';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    }

    // ========================================================================
    // URL resolution
    // ========================================================================

    private resolveUrl(url: string | undefined): string | undefined {
        if (!url) return url;
        try {
            new URL(url);
            return url;
        } catch {
            const baseUrl = new URL(this.api['_base'] as string);
            const normalizedUrl = url.startsWith('/') ? url : '/' + url;

            if (normalizedUrl.startsWith(baseUrl.pathname.replace(/\/+$/, '') + '/')) {
                return `${baseUrl.origin}${normalizedUrl}`;
            }

            const base = (this.api['_base'] as string).replace(/\/+$/, '');
            return base + normalizedUrl;
        }
    }

    // ========================================================================
    // Optimistic message management
    // ========================================================================

    private revokeMessageBlobUrls(message: Message): void {
        if (!message._blobUrls) return;
        message._blobUrls.forEach((url) => URL.revokeObjectURL(url));
    }

    private reconcilePendingSend(
        content: string,
        attachments: Attachment[],
        serverMessage: { attachments?: Attachment[]; sentAt?: string }
    ): boolean {
        const entry = this.tracker.findUnresolved(content, attachments, serverMessage.sentAt);
        if (entry) {
            this.tracker.resolve(entry);
            this.updateOptimisticMessage(entry.tempId, serverMessage.attachments, serverMessage.sentAt);
            return true;
        }

        return this.tracker.findResolved(content, attachments, serverMessage.sentAt) !== null;
    }

    private reconcilePendingSendByTempId(
        tempId: string,
        serverMessage: { attachments?: Attachment[] | AttachmentDTO[]; sentAt?: string }
    ): boolean {
        const entry = this.tracker.findByTempId(tempId);
        if (!entry) return false;
        if (entry.status === 'resolved') {
            this.updateOptimisticMessage(tempId, serverMessage.attachments, serverMessage.sentAt);
            return true;
        }
        if (entry.status !== 'active') return false;

        this.tracker.resolve(entry);
        this.updateOptimisticMessage(tempId, serverMessage.attachments, serverMessage.sentAt);
        return true;
    }

    private updateOptimisticMessage(
        tempId: string,
        serverAttachments: Attachment[] | AttachmentDTO[] | undefined,
        sentAt: string | undefined
    ): void {
        const idx = this.messages.findIndex((m) => m.id === tempId);
        if (idx === -1) return;

        const oldMsg = this.messages[idx]!;
        this.revokeMessageBlobUrls(oldMsg);

        const normalizedServerAttachments = Array.isArray(serverAttachments)
            ? serverAttachments.map((a, i) => normalizeAttachment({
                ...a,
                fileName: a.fileName ?? oldMsg.attachments[i]?.fileName,
                contentType: a.contentType ?? oldMsg.attachments[i]?.contentType
            }, (url) => this.resolveUrl(url)))
            : oldMsg.attachments.map((a) => ({ ...a, temp: false }));

        this.messages[idx] = {
            ...oldMsg,
            sentAt: sentAt ?? oldMsg.sentAt,
            attachments: normalizedServerAttachments
        };

        delete (this.messages[idx] as Partial<typeof oldMsg>)._blobUrls;
        delete (this.messages[idx] as Partial<typeof oldMsg>).failed;

        // Only re-sort if timestamp changed
        if (sentAt && sentAt !== oldMsg.sentAt) {
            // Use UTC-aware comparison for consistent ordering
            this.messages.sort((a, b) => compareUtcDates(a.sentAt, b.sentAt));
            this.renderMessages(true);
        } else {
            this.renderMessages(true);
        }
    }

    private markMessageAsFailed(tempId: string): void {
        const idx = this.messages.findIndex((m) => m.id === tempId);
        if (idx !== -1) {
            (this.messages[idx] as { failed?: boolean }).failed = true;
            this.renderMessages(true);
        }
        this.tracker.markFailed(tempId);
    }

    // ========================================================================
    // SignalR + history
    // ========================================================================

    private async connect(): Promise<void> {
        // Check if circuit breaker allows connection attempt
        if (!this.circuitBreaker.canAttemptReconnect()) {
            console.log('[CircuitBreaker] Connection blocked - circuit is OPEN');
            this.updateConnectionErrorUI();
            return;
        }

        if (this.connected && this.signalr) return;
        this.connected = true;

        if (this.signalr) {
            try { await this.signalr.stop(); } catch { /* ignore */ }
            this.signalr = null;
        }

        this.signalr = new SignalRManager(
            this.cfg,
            (content, sentAt, attachments, isFromLead = false) => {
                const normalizedAttachments = (attachments ?? [])
                    .map((a) => normalizeAttachment(a, (url) => this.resolveUrl(url)));

                if (isFromLead && this.reconcilePendingSend(content, normalizedAttachments, {
                    attachments: normalizedAttachments,
                    sentAt
                })) return;

                // Real-time messages always append to the end - never re-order history
                // Only initial history load should be sorted chronologically
                const newMessage: Message = { content, sentAt, isFromLead, attachments: normalizedAttachments };
                this.messages.push(newMessage);

                if (!this.isOpen) {
                    this.unread++;
                    this.updateBadge();
                }
                if (this.cfg.soundEnabled && !isFromLead) playNotificationSound();

                // Render at the end
                this.appendMessageToDOM(this.messages.length - 1);
                this.scrollToBottom();
                this.emit('message', { content, sentAt, isFromLead });
            },
            (status) => {
                this.status = status;
                this.updateStatus();
            },
            (retryCount) => {
                // SignalR is attempting automatic reconnect
                this.signalrReconnectAttempt = retryCount;
                this.updateConnectionErrorUI();
            }
        );

        try {
            if (this.senderIdentifier) {
                const history = await this.api.loadHistory(this.senderIdentifier) as HistoryDTO | undefined;
                const normalized = normalizeHistoryPayload(history, (url) => this.resolveUrl(url));
                if (normalized.conversationId) {
                    this.conversationId = normalized.conversationId;
                }
                this.messages = normalized.messages;
                this.renderMessages(true);
                this.scrollToBottom(true);
            }
        } catch (err) {
            console.warn('Failed to load history:', err);
            this.emit('historyError', { error: err instanceof Error ? err.message : 'Unknown error' });
        }

        try {
            await this.signalr.start(this.conversationId);
            // Success! Reset circuit breaker
            this.circuitBreaker.recordSuccess();
            this.signalrReconnectAttempt = 0;
        } catch (err) {
            console.error('SignalR connection error', err);
            this.circuitBreaker.recordFailure();
            this.connected = false;
            this.signalr = null;
            this.updateStatus();
            this.updateConnectionErrorUI();
            
            // Don't throw - let the UI handle the failure state
            // throw err;
        }
    }

    // ========================================================================
    // Message rendering (incremental)
    // ========================================================================

    private renderMessages(fullRender = false): void {
        if (!this.elMessages) return;

        if (fullRender || this.messages.length <= 1) {
            // Full render for initial load or single message
            const result = this.renderer.renderMessages(this.messages);
            this.elMessages.innerHTML = result.html;
        }
    }

    private appendMessageToDOM(index: number): void {
        if (!this.elMessages || index < 0 || index >= this.messages.length) return;

        // When inserting in the middle of the list, we need a full re-render
        // to maintain proper chronological order and message grouping
        const isLastMessage = index === this.messages.length - 1;
        
        if (!isLastMessage) {
            // Message inserted in the middle - full re-render required
            this.renderMessages(true);
            this.scrollToBottom(true);
            return;
        }

        // Message is at the end - can use incremental rendering
        const message = this.messages[index]!;
        const isStart = isStartOfNewGroup(this.messages, index);
        const isEnd = isEndOfGroup(this.messages, index);

        // Only animate new messages (when appended at the end)
        const shouldAnimate = index === this.messages.length - 1;
        const html = this.renderer.renderSingleMessage(message, isStart, isEnd, shouldAnimate);

        if (isStart) {
            // New group - append directly to end
            this.elMessages.insertAdjacentHTML('beforeend', html);
        } else {
            // Same group - need to modify existing last group
            // For simplicity, do a targeted re-render of the last group
            this.renderMessages(true);
        }

        this.scrollToBottom(true);
    }

    private scrollToBottom(force = false): void {
        if (!this.elBody) return;
        const isNearBottom = this.elBody.scrollHeight - this.elBody.scrollTop - this.elBody.clientHeight < 120;
        if (!force && !isNearBottom) return;
        requestAnimationFrame(() => {
            if (this.elBody) this.elBody.scrollTop = this.elBody.scrollHeight;
        });
    }

    // ========================================================================
    // Badge + status UI
    // ========================================================================

    private updateBadge(): void {
        if (!this.badge) return;
        if (this.unread > 0) {
            this.badge.textContent = this.unread > 9 ? '9+' : String(this.unread);
            this.badge.classList.add('visible');
            this.fab?.classList.add('has-unread');
        } else {
            this.badge.classList.remove('visible');
            this.fab?.classList.remove('has-unread');
        }
    }

    private updateStatus(): void {
        if (!this.elStatus) return;

        if (this.status === 'connected') {
            this.elStatus.className = 'sw-status hidden';
            this.signalrReconnectAttempt = 0;
            this.removeErrorMessages();
        } else if (this.status === 'connecting') {
            this.elStatus.className = 'sw-status connecting';
            this.elStatus.textContent = 'Conectando…';
        } else {
            this.elStatus.className = 'sw-status disconnected';
            
            // Show different message based on circuit breaker state
            if (this.circuitBreaker.isOpen()) {
                this.elStatus.textContent = 'Desconectado — Requiere acción';
            } else {
                this.elStatus.textContent = 'Desconectado — Reintentando…';
            }
        }
    }

    private updateConnectionErrorUI(): void {
        if (!this.popup) return;

        let errorDiv = this.popup.querySelector('#sw-connection-error') as HTMLDivElement | null;
        
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'sw-error-message';
            errorDiv.id = 'sw-connection-error';
            const header = this.popup.querySelector('.sw-header');
            header?.insertAdjacentElement('afterend', errorDiv);
        }

        const circuitState = this.circuitBreaker.getState();
        const failureCount = this.circuitBreaker.getFailureCount();
        const maxFailures = 3; // matches CircuitBreaker threshold

        if (circuitState === 'OPEN') {
            // Circuit is open - show manual retry button with actual failure count
            errorDiv.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <span>⚠️ No se pudo conectar después de ${failureCount} intentos.</span>
                    <button class="sw-reconnect-btn">Reintentar conexión</button>
                </div>
            `;
            const btn = errorDiv.querySelector('.sw-reconnect-btn');
            if (btn) {
                const newBtn = btn.cloneNode(true) as HTMLButtonElement;
                btn.parentNode?.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => void this.forceReconnect());
            }
        } else if (circuitState === 'HALF_OPEN') {
            // Attempting manual recovery
            errorDiv.innerHTML = '🔄 Intentando reconectar...';
        } else {
            // Circuit closed - automatic retry in progress
            // Show SignalR's automatic reconnect attempt count
            const attempt = Math.min(this.signalrReconnectAttempt, maxFailures);
            errorDiv.innerHTML = `⚠️ Problemas de conexión. Reintentando (${attempt}/${maxFailures})...`;
        }
    }

    private handleCircuitStateChange(state: CircuitState, failureCount: number): void {
        console.log(`[CircuitBreaker] State changed to ${state} after ${failureCount} failures`);
        
        if (state === 'OPEN') {
            // Circuit just opened - update UI immediately
            this.updateConnectionErrorUI();
            this.emit('connectionError', { 
                error: `Connection failed after ${failureCount} attempts. Manual retry required.` 
            } as WidgetEventMap['connectionError']);
        } else if (state === 'CLOSED') {
            // Circuit closed - connection restored
            this.removeErrorMessages();
        }
    }

    private removeErrorMessages(): void {
        const err = this.popup?.querySelector('#sw-connection-error');
        err?.remove();
    }

    private async forceReconnect(): Promise<void> {
        console.log('[CircuitBreaker] Manual reconnect requested by user');
        
        // Clear UI error messages
        this.removeErrorMessages();
        
        // Reset circuit breaker to HALF_OPEN (allows one attempt)
        if (this.circuitBreaker.attemptReset()) {
            this.signalrReconnectAttempt = 0;
            this.connected = false;

            if (this.signalr) {
                try { await this.signalr.stop(); } catch { /* ignore */ }
            }

            this.signalr = null;
            
            // Show "Connecting..." state
            this.status = 'connecting';
            this.updateStatus();
            
            // Attempt reconnection
            await this.connect();
        } else {
            console.log('[CircuitBreaker] Reset not allowed - circuit is:', this.circuitBreaker.getState());
        }
    }

    // ========================================================================
    // Message sending (with rate limiting)
    // ========================================================================

    private async sendMessage(): Promise<void> {
        // Rate limiting check
        const now = Date.now();
        if (now - this.lastSendTime < MIN_SEND_INTERVAL_MS) {
            console.warn('Widget: Message send rate limited');
            return;
        }

        if (!this.userSet) return;
        if (!this.elInput) return;

        const text = this.elInput.value.trim();
        const pending = [...this.pendingAttachments];
        if (!text && pending.length === 0) return;
        if (this.sending) return;

        if (!this.signalr || this.status !== 'connected') {
            console.warn('No conectado, no se envía el mensaje');
            return;
        }

        this.sending = true;
        this.lastSendTime = Date.now();
        this.elInput.value = '';
        if (this.elSendBtn) {
            this.elSendBtn.disabled = true;
            this.elSendBtn.classList.add('sending');
        }

        const tempId = this.tracker.createTempId();
        const sentAt = new Date().toISOString();
        const normalizedContent = text.trim();

        const optimisticMsg: Message = {
            id: tempId,
            content: normalizedContent,
            sentAt,
            isFromLead: true,
            attachments: pending.map((a) => ({
                ...normalizeAttachment({
                    url: a.localUrl,
                    fileName: a.fileName,
                    contentType: a.file.type
                }, (url) => url),
                temp: true
            })),
            _blobUrls: pending.map((a) => a.localUrl)
        };

        this.tracker.register(tempId, sentAt, normalizedContent, pending);
        // Optimistic messages always append to the end (they are the newest from user's perspective)
        // Only backend messages get sorted chronologically
        this.messages.push(optimisticMsg);
        this.appendMessageToDOM(this.messages.length - 1);
        this.scrollToBottom(true);

        // Clear draft on send
        this.clearDraft();

        try {
            const res = await this.api.sendMessage(
                text,
                this.senderIdentifier,
                this.cfg.productName ?? '',
                this.conversationId,
                pending.map((a) => a.file),
                this.senderCompany,
                window.location.href
            );

            const newConvId = res.conversationId ?? res.ConversationId;
            if (newConvId && this.conversationId !== String(newConvId)) {
                this.conversationId = String(newConvId);
                await this.signalr?.joinConversation(this.conversationId);
            }

            const responseAttachments = Array.isArray(res.attachments)
                ? res.attachments
                : Array.isArray(res.Attachments)
                    ? res.Attachments
                    : [];
            const hasCanonicalAttachments = responseAttachments.length > 0;
            if (pending.length === 0 || hasCanonicalAttachments) {
                this.reconcilePendingSendByTempId(tempId, {
                    attachments: responseAttachments,
                    sentAt: res.sentAt ?? res.SentAt
                });
            }
        } catch (err) {
            console.error('Send message error:', err);
            this.markMessageAsFailed(tempId);
            this.emit('sendError', {
                error: err instanceof Error ? err.message : 'Unknown error',
                tempId
            });
        } finally {
            this.clearPendingAttachments(false);
            this.sending = false;
            if (this.elSendBtn) {
                this.elSendBtn.classList.remove('sending');
            }
            this.updateSendButton();
        }
    }

    // ========================================================================
    // Event emitter
    // ========================================================================

    private emit<T extends WidgetEvent>(event: T, data: WidgetEventMap[T]): void {
        const callbacks = this.listeners[event];
        if (!callbacks) return;
        callbacks.forEach((cb) => {
            try {
                (cb as (data: WidgetEventMap[T]) => void)(data);
            } catch (e) {
                console.error(`Widget event listener error [${event}]`, e);
            }
        });
    }

    // ========================================================================
    // Public API
    // ========================================================================

    open(): void {
        if (this.isOpen) return;
        this.isOpen = true;
        this.viewportCtx.isOpen = true;
        this.unread = 0;
        this.updateBadge();
        this.fab?.classList.add('open');
        this.popup?.classList.add('visible');
        updateMobileViewportLayout(this.popup, this.viewportCtx, true, () => this.scrollToBottom(true));
        this.elInput?.focus();
        void this.connect();
        this.scrollToBottom(true);
        this.emit('open', undefined as WidgetEventMap['open']);
    }

    close(): void {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.viewportCtx.isOpen = false;
        this.fab?.classList.remove('open');
        this.popup?.classList.remove('visible');
        updateMobileViewportLayout(this.popup, this.viewportCtx, false, undefined);
        this.fab?.focus();
        this.emit('close', undefined as WidgetEventMap['close']);
    }

    toggle(): void {
        this.isOpen ? this.close() : this.open();
    }

    destroy(): void {
        this.messages.forEach((m) => this.revokeMessageBlobUrls(m));
        this.pendingAttachments.forEach((a) => URL.revokeObjectURL(a.localUrl));

        if (this.signalr) {
            try { void this.signalr.stop(); } catch { /* ignore */ }
            this.signalr = null;
        }

        this.unbindViewportEvents?.();

        if (this.shadow) this.shadow.innerHTML = '';

        this.host?.parentNode?.removeChild(this.host);

        // Clear all listeners
        for (const key of Object.keys(this.listeners)) {
            delete this.listeners[key as WidgetEvent];
        }
    }

    on<T extends WidgetEvent>(event: T, callback: (data: WidgetEventMap[T]) => void): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        (this.listeners[event] as Array<(data: WidgetEventMap[T]) => void>).push(callback);
    }

    setCredentials(userName: string, password: string, senderIdentifier: string): void {
        if (!userName || !password || !senderIdentifier) return;
        setWidgetCredentials(userName, password);
        this.senderIdentifier = senderIdentifier;
        this.userSet = true;
        if (this.host) this.host.style.display = '';
        this.emit('credentialsSet', { senderIdentifier });
    }

    setUser(userName: string, empresa: string): void {
        if (!userName || !empresa) return;
        this.senderIdentifier = userName;
        this.senderCompany = empresa;
        this.userSet = true;
        if (this.host) this.host.style.display = '';
        if (this.elInput) {
            this.elInput.disabled = false;
            this.elInput.placeholder = 'Escribe un mensaje…';
        }
        this.emit('userSet', { userName, empresa });
    }
}
