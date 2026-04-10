import { ApiClient } from "./api-client.js";
import { SignalRManager } from "./signalr-manager.js";
import { generateStyles, closeIconSvg } from "./styles.js";
import { escapeHtml, formatTime, playNotificationSound, setWidgetCredentials } from "./utils.js";

const IMAGE_CONTENT_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
]);

const ALLOWED_ATTACHMENT_CONTENT_TYPES = {
    "image/jpeg": 1,
    "image/png": 1,
    "image/gif": 1,
    "image/webp": 1,
    "application/pdf": 1
};

const PASTED_IMAGE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp"
};

const FILE_KIND_IMAGE = "image";
const FILE_KIND_PDF = "pdf";
const FILE_KIND_GENERIC = "file";

function createPastedImageName(contentType) {
    const extension = PASTED_IMAGE_EXTENSIONS[contentType] || "png";
    return `imagen-pegada-${Date.now()}.${extension}`;
}

function ensurePastedImageName(file) {
    if (!file || file.name) return file;

    const fileName = createPastedImageName(file.type);
    if (typeof File === "function") {
        return new File([file], fileName, {
            type: file.type,
            lastModified: file.lastModified || Date.now()
        });
    }

    return file;
}

function extractPastedImages(clipboardData) {
    if (!clipboardData) return [];

    const files = [];
    if (clipboardData.items && clipboardData.items.length) {
        Array.from(clipboardData.items).forEach((item) => {
            if (item.kind !== "file" || !IMAGE_CONTENT_TYPES.has(item.type)) return;
            const file = item.getAsFile();
            if (file) files.push(ensurePastedImageName(file));
        });
        return files;
    }

    if (clipboardData.files && clipboardData.files.length) {
        Array.from(clipboardData.files).forEach((file) => {
            if (IMAGE_CONTENT_TYPES.has(file.type)) files.push(ensurePastedImageName(file));
        });
    }

    return files;
}

function inferAttachmentContentType(attachment) {
    const explicitType = typeof attachment.contentType === "string"
        ? attachment.contentType.trim().toLowerCase()
        : "";

    if (explicitType) {
        return explicitType;
    }

    const source = (
        attachment.fileName ||
        attachment.url ||
        attachment.imageUrl ||
        attachment.sasUrl ||
        ""
    ).toLowerCase().split("?")[0].split("#")[0];

    if (source.endsWith(".pdf")) return "application/pdf";
    if (source.endsWith(".png")) return "image/png";
    if (source.endsWith(".gif")) return "image/gif";
    if (source.endsWith(".webp")) return "image/webp";
    if (source.endsWith(".jpg") || source.endsWith(".jpeg")) return "image/jpeg";

    return "";
}

function getAttachmentKind(attachment) {
    const contentType = inferAttachmentContentType(attachment);

    if (IMAGE_CONTENT_TYPES.has(contentType)) return FILE_KIND_IMAGE;
    if (contentType === "application/pdf") return FILE_KIND_PDF;

    return FILE_KIND_GENERIC;
}

export function normalizeAttachment(attachment, resolveUrl) {
    const url = resolveUrl(attachment.sasUrl || attachment.imageUrl || attachment.url || attachment.localUrl);
    const contentType = inferAttachmentContentType(attachment);
    const fileName = attachment.fileName || attachment.name || "Archivo";

    return {
        url,
        imageUrl: url,
        fileName,
        contentType,
        kind: getAttachmentKind({ ...attachment, contentType, fileName, url })
    };
}

function normalizeHistoryMessage(message, resolveUrl) {
    let content = message.content || message.Content || "";
    if (typeof content === "object" && content !== null) {
        content = content.content || content.Content || JSON.stringify(content);
    }

    const rawAttachments = Array.isArray(message.attachments)
        ? message.attachments
        : Array.isArray(message.Attachments)
            ? message.Attachments
            : [];
    const attachments = rawAttachments.map((attachment) => normalizeAttachment(attachment, resolveUrl));

    return {
        content: String(content),
        sentAt: message.sentAt || message.SentAt,
        isFromLead: message.isFromLead !== undefined ? message.isFromLead : message.IsFromLead,
        attachments
    };
}

export function normalizeHistoryPayload(payload, resolveUrl) {
    const history = payload ?? [];
    const conversation = Array.isArray(history)
        ? null
        : history.conversation || history.Conversation || history;
    const rawMessages = Array.isArray(history)
        ? history
        : [
            conversation?.messages,
            conversation?.Messages,
            history.messages,
            history.Messages
        ].find(Array.isArray) || [];
    const rawConversationId =
        conversation?.conversationId ??
        conversation?.ConversationId ??
        conversation?.id ??
        conversation?.Id ??
        history.conversationId ??
        history.ConversationId ??
        history.id ??
        history.Id ??
        null;

    return {
        conversationId: rawConversationId == null || rawConversationId === "" ? null : String(rawConversationId),
        messages: rawMessages.map((message) => normalizeHistoryMessage(message, resolveUrl))
    };
}

export class UI {
    constructor(config) {
        this.cfg = config;
        this.api = new ApiClient(config);
        this.signalr = null;
        this.messages = [];
        this.isOpen = false;
        this.unread = 0;
        this.conversationId = null;
        this.senderIdentifier = config.senderIdentifier || "";
        this._senderCompany = config.senderCompany || "";
        this._connected = false;
        this._status = "disconnected";
        this._listeners = {};
        this._sending = false;
        this._pendingAttachments = [];
        this._userSet = false;
        this._connectionError = false;

        // Auto-initialize when credentials + sender identity are supplied in config
        if (config.credentials?.userName && config.credentials?.password) {
            setWidgetCredentials(config.credentials.userName, config.credentials.password);
        }

        if (this.senderIdentifier) 
            this._userSet = true;
        
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 5;
        this._showReconnectBar = false;

        this._buildDOM();
    }

    _buildDOM() {
        const t = this.cfg;

        this.host = document.createElement("div");
        this.host.setAttribute("id", "soporte-widget-host");
        this.shadow = this.host.attachShadow({ mode: "closed" });

        const style = document.createElement("style");
        style.textContent = generateStyles(t);
        this.shadow.appendChild(style);

        // FAB
        this.fab = document.createElement("button");
        this.fab.className = "sw-fab";
        this.fab.setAttribute("aria-label", "Abrir chat de soporte");
        this.fab.innerHTML = `<svg class="sw-icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>${closeIconSvg}<span class="sw-fab-ring"></span><span class="sw-badge"></span>`;
        this.fab.addEventListener("click", () => this.toggle());
        this.shadow.appendChild(this.fab);
        this.badge = this.fab.querySelector(".sw-badge");

        // Popup
        this.popup = document.createElement("div");
        this.popup.className = "sw-popup";
        this.popup.setAttribute("role", "dialog");
        this.popup.setAttribute("aria-label", t.title);
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
            <div class="sw-footer">
                <button class="sw-attach-btn" aria-label="Adjuntar archivo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>
                <input class="sw-input" type="text" placeholder="Escribe un mensaje…" aria-label="Mensaje" />
                <button class="sw-send-btn" aria-label="Enviar" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
            </div>
            <input class="sw-file-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" multiple style="display:none;" />
            <div class="sw-powered">Powered by <a href="#">DPS</a></div>
        `;
        this.shadow.appendChild(this.popup);

        this.elStatus = this.popup.querySelector(".sw-status");
        this.elMessages = this.popup.querySelector(".sw-messages");
        this.elBody = this.popup.querySelector(".sw-body");
        this.elInput = this.popup.querySelector(".sw-input");
        this.elSendBtn = this.popup.querySelector(".sw-send-btn");
        this.elFooter = this.popup.querySelector(".sw-footer");
        this.elAttachBtn = this.popup.querySelector(".sw-attach-btn");
        this.elFileInput = this.popup.querySelector(".sw-file-input");
        this.elAttachmentPreview = this.popup.querySelector(".sw-attachment-preview");

        // Event listeners
        this.popup.querySelector(".sw-btn-close").addEventListener("click", () => this.close());

        this.elAttachBtn.addEventListener("click", () => {
            this.elFileInput.click();
        });

        this.elFileInput.addEventListener("change", () => {
            if (this.elFileInput.files) {
                Array.from(this.elFileInput.files).forEach(f => this._handleFileSelect(f));
            }
            this.elFileInput.value = "";
        });

        this.elInput.addEventListener("input", () => {
            this._updateSendButton();
        });

        this.elInput.addEventListener("focus", () => {
            this.elFooter.classList.add("focused");
        });

        this.elInput.addEventListener("blur", () => {
            this.elFooter.classList.remove("focused");
        });

        this.elInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this._sendMessage();
            }
        });

        this.elSendBtn.addEventListener("click", () => this._sendMessage());

        this.elMessages.addEventListener("click", (e) => {
            const fileLink = e.target.closest(".sw-msg-file");
            if (fileLink) {
                e.preventDefault();
                this._downloadAttachment(fileLink.dataset.url, fileLink.dataset.fileName);
                return;
            }

            const img = e.target.closest(".sw-msg-image");
            if (img) this._openLightbox(img.src);
        });

        this.popup.addEventListener("paste", (e) => {
            this._handlePaste(e);
        });

        this.shadow.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isOpen) this.close();
        });

        document.body.appendChild(this.host);

        if (!this._userSet) {
            console.warn("Widget hidden: user not set");
            this.host.style.display = "none";
        }

        this._renderMessages();
    }

    _updateSendButton() {
        this.elSendBtn.disabled = !this.elInput.value.trim() && this._pendingAttachments.length === 0;
    }

    _handlePaste(event) {
        const pastedImages = extractPastedImages(event?.clipboardData);
        if (pastedImages.length === 0) return;

        event.preventDefault();
        pastedImages.forEach((file) => this._handleFileSelect(file));
    }

    _handleFileSelect(file) {
        if (!ALLOWED_ATTACHMENT_CONTENT_TYPES[file.type]) return;
        if (file.size > 5 * 1024 * 1024) return; // 5MB

        const fileName = file.name || createPastedImageName(file.type);
        this._pendingAttachments.push({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            file,
            fileName,
            contentType: file.type,
            kind: getAttachmentKind({ contentType: file.type, fileName }),
            localUrl: URL.createObjectURL(file)
        });
        this._showAttachmentPreview();
        this._updateSendButton();
    }

    _showAttachmentPreview() {
        if (this._pendingAttachments.length === 0) {
            this.elAttachmentPreview.style.display = "none";
            this.elAttachmentPreview.innerHTML = "";
            return;
        }
        this.elAttachmentPreview.innerHTML = this._pendingAttachments.map((attachment) => {
            const previewContent = attachment.kind === FILE_KIND_IMAGE
                ? `<img class="sw-attachment-preview-thumb" src="${attachment.localUrl}" />`
                : `
                    <div class="sw-msg-file sw-msg-file-${attachment.kind}">
                        <span class="sw-msg-file-icon">${attachment.kind === FILE_KIND_PDF ? "PDF" : "FILE"}</span>
                        <div class="sw-msg-file-meta">
                            <div class="sw-msg-file-name">${escapeHtml(attachment.fileName)}</div>
                            <div class="sw-msg-file-action">${attachment.kind === FILE_KIND_PDF ? "PDF listo para enviar" : "Archivo listo para enviar"}</div>
                        </div>
                    </div>
                `;

            return `
                <div class="sw-attachment-preview-item" data-id="${attachment.id}">
                    ${previewContent}
                    <button class="sw-attachment-preview-remove" aria-label="Quitar">×</button>
                </div>
            `;
        }).join("");
        this.elAttachmentPreview.style.display = "flex";
        this.elAttachmentPreview.querySelectorAll(".sw-attachment-preview-remove").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.closest(".sw-attachment-preview-item").dataset.id;
                this._removePendingAttachment(id);
            });
        });
    }

    _clearPendingAttachments(revoke = true) {
        if (revoke) {
            this._pendingAttachments.forEach(attachment => URL.revokeObjectURL(attachment.localUrl));
        }
        this._pendingAttachments = [];
        this.elAttachmentPreview.style.display = "none";
        this.elAttachmentPreview.innerHTML = "";
        this._updateSendButton();
    }

    _removePendingAttachment(id) {
        const idx = this._pendingAttachments.findIndex(attachment => attachment.id === id);
        if (idx !== -1) {
            URL.revokeObjectURL(this._pendingAttachments[idx].localUrl);
            this._pendingAttachments.splice(idx, 1);
        }
        this._showAttachmentPreview();
        this._updateSendButton();
    }

    _openLightbox(src) {
        const lightbox = document.createElement("div");
        lightbox.className = "sw-lightbox";
        lightbox.innerHTML = `<img src="${src}" />`;
        lightbox.addEventListener("click", () => lightbox.remove());
        this.shadow.appendChild(lightbox);
    }

    async _downloadAttachment(url, fileName) {
        if (!url) return;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = fileName || "archivo";
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
            }, 1000);
        } catch (error) {
            console.warn("Attachment download fallback", error);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName || "archivo";
            link.rel = "noopener noreferrer";
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    }

    _resolveUrl(url) {
        if (!url) return url;
        try {
            // Si ya es absoluta, devolverla
            new URL(url);
            return url;
        } catch {
            // Si es relativa, concatenar con la base de la API
            const base = this.api._base.replace(/\/+$/, '');
            return base + (url.startsWith('/') ? url : '/' + url);
        }
    }

    _connect() {
        if (this._connected && this.signalr) {
            return Promise.resolve();
        }
        this._connected = true;
        
        if (this.signalr) {
            try { this.signalr.stop(); } catch {}
            this.signalr = null;
        }

        this.signalr = new SignalRManager(
            this.cfg,
            (content, sentAt, attachments, isFromLead = false) => {
                const normalizedAttachments = (attachments || [])
                    .map((attachment) => normalizeAttachment(attachment, (url) => this._resolveUrl(url)));

                // Avoid duplicates (e.g. optimistic message already rendered)
                if (this.messages.some(m =>
                    m.content === content &&
                    Math.abs(new Date(m.sentAt) - new Date(sentAt)) < 2000 &&
                    m.isFromLead === isFromLead &&
                    JSON.stringify(m.attachments) === JSON.stringify(normalizedAttachments)
                )) return;

                const msg = {
                    content,
                    sentAt,
                    isFromLead,
                    attachments: normalizedAttachments
                };
                this.messages.push(msg);
                if (!this.isOpen) {
                    this.unread++;
                    this._updateBadge();
                }
                if (this.cfg.soundEnabled && !isFromLead) playNotificationSound();
                this._renderMessages();
                this._scrollToBottom();
                this._emit("message", { content, sentAt, isFromLead });
            },
            (status) => {
                this._status = status;
                this._updateStatus();
            }
        );

        const historyPromise = this.senderIdentifier
            ? this.api.loadHistory(this.senderIdentifier).then(history => {
                const normalized = normalizeHistoryPayload(history, (url) => this._resolveUrl(url));
                if (normalized.conversationId) {
                    this.conversationId = normalized.conversationId;
                }
                this.messages = normalized.messages;
                this._renderMessages();
                this._scrollToBottom(true);
            }).catch(() => {})
            : Promise.resolve();

        return historyPromise
            .then(() => this.signalr.start(this.conversationId))
            .catch(err => {
                console.error("SignalR connection error", err);
                this._connected = false;
                this.signalr = null;
                this._updateStatus();
                throw err;
            });
    }

    _sendMessage() {
        if (!this._userSet) return Promise.resolve();

        const text = this.elInput.value.trim();
        const pending = [...this._pendingAttachments];
        if (!text && pending.length === 0) return Promise.resolve();
        if (this._sending) return Promise.resolve();

        if (!this.signalr || this._status !== "connected") {
            console.warn("No conectado, no se envía el mensaje");
            return Promise.resolve();
        }

        this._sending = true;
        this.elInput.value = "";
        this.elSendBtn.disabled = true;

        const tempId = Date.now().toString();
        const optimisticMsg = {
            id: tempId,
            content: text,
            sentAt: new Date().toISOString(),
            isFromLead: true,
            attachments: pending.map((attachment) => ({
                ...normalizeAttachment({
                    url: attachment.localUrl,
                    fileName: attachment.fileName,
                    contentType: attachment.file.type
                }, (url) => url),
                temp: true
            })),
            _blobUrls: pending.map(p => p.localUrl)
        };
        this.messages.push(optimisticMsg);
        this._renderMessages();
        this._scrollToBottom(true);

        return this.api.sendMessage(
            text,
            this.senderIdentifier,
            this.cfg.productName,
            this.conversationId,
            pending.map(attachment => attachment.file),
            this._senderCompany,
            window.location.href
        )
        .then(res => {
            const newConvId = res.conversationId;
            if (newConvId && this.conversationId !== String(newConvId)) {
                this.conversationId = String(newConvId);
                if (this.signalr) this.signalr.joinConversation(this.conversationId);
            }
            if (res.attachments && res.attachments.length > 0) {
                this._updateOptimisticMessage(tempId, res.attachments);
            }
        })
        .catch(err => {
            this._markMessageAsFailed(tempId);
        })
        .finally(() => {
            this._clearPendingAttachments(false);
            this._sending = false;
            this._updateSendButton();
        });
    }

    _updateOptimisticMessage(tempId, serverAttachments) {
        const oldMsg = this.messages.find(m => m.id === tempId);
        if (!oldMsg) return;

        if (oldMsg._blobUrls) {
            oldMsg._blobUrls.forEach(url => URL.revokeObjectURL(url));
        }

        const updated = {
            content: oldMsg.content,
            sentAt: oldMsg.sentAt,
            isFromLead: true,
            attachments: serverAttachments.map((attachment, i) => normalizeAttachment({
                ...attachment,
                fileName: attachment.fileName || oldMsg.attachments[i]?.fileName,
                contentType: attachment.contentType || oldMsg.attachments[i]?.contentType
            }, (url) => this._resolveUrl(url)))
        };
        this.messages = [
            ...this.messages.filter(m => m.id !== tempId),
            updated
        ];

        this.messages.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
        this._renderMessages();
    }

    _markMessageAsFailed(tempId) {
        const idx = this.messages.findIndex(m => m.id === tempId);
        if (idx !== -1) {
            this.messages[idx].failed = true;
            this._renderMessages();
        }
    }

    _renderMessages() {
        const cfg = this.cfg;
        if (this.messages.length === 0) {
            this.elMessages.innerHTML = `
                <div class="sw-welcome">
                    <div class="sw-welcome-icon">
                        ${cfg.avatarImage ? `<img src="${escapeHtml(cfg.avatarImage)}" alt="${escapeHtml(cfg.title)}" />` : escapeHtml(cfg.avatarLetter)}
                    </div>
                    <div class="sw-welcome-title">${escapeHtml(cfg.title)}</div>
                    <div class="sw-welcome-text">${escapeHtml(cfg.welcomeMessage)}</div>
                </div>
            `;
            return;
        }

        const renderAttachment = (attachment) => {
            const attachmentUrl = attachment.url || attachment.imageUrl;
            if (!attachmentUrl) return "";

            if (attachment.kind === FILE_KIND_IMAGE) {
                return `<img class="sw-msg-image" src="${escapeHtml(attachmentUrl)}" alt="${escapeHtml(attachment.fileName || "imagen")}" />`;
            }

            const fileLabel = attachment.kind === FILE_KIND_PDF ? "Descargar PDF" : "Descargar archivo";
            const fileIcon = attachment.kind === FILE_KIND_PDF ? "PDF" : "FILE";

            return `
                <a class="sw-msg-file sw-msg-file-${attachment.kind}" href="${escapeHtml(attachmentUrl)}" download="${escapeHtml(attachment.fileName || "archivo")}" data-url="${escapeHtml(attachmentUrl)}" data-file-name="${escapeHtml(attachment.fileName || "archivo")}">
                    <span class="sw-msg-file-icon">${fileIcon}</span>
                    <div class="sw-msg-file-meta">
                        <div class="sw-msg-file-name">${escapeHtml(attachment.fileName || "Archivo")}</div>
                        <div class="sw-msg-file-action">${fileLabel}</div>
                    </div>
                </a>
            `;
        };

        const renderMessageContent = (msg) => {
            let html = "";
            const attachments = msg.attachments || [];
            for (const attachment of attachments) {
                html += renderAttachment(attachment);
            }
            if (msg.content) {
                html += `<div class="sw-msg-text">${escapeHtml(msg.content)}</div>`;
            }
            if (msg.failed) {
                html += '<div class="sw-msg-error" style="color: #ef4444; font-size: 11px; margin-top: 4px;">⚠️ Error al enviar</div>';
            }
            return html;
        };

        let output = "";
        const msgs = this.messages;
        let i = 0;
        while (i < msgs.length) {
            const current = msgs[i];
            const isLead = current.isFromLead;
            let lastTime = current.sentAt;

            if (isLead) {
                output += '<div class="sw-msg-out-group">';
                while (i < msgs.length && msgs[i].isFromLead) {
                    output += `<div class="sw-msg-out">${renderMessageContent(msgs[i])}</div>`;
                    lastTime = msgs[i].sentAt;
                    i++;
                }
                output += `<div class="sw-msg-time">${lastTime ? formatTime(lastTime) : ""}</div>`;
                output += '</div>';
            } else {
                output += '<div class="sw-msg-in-group">';
                output += `<div class="sw-msg-sender">${escapeHtml(cfg.agentName)}</div>`;
                while (i < msgs.length && !msgs[i].isFromLead) {
                    output += `<div class="sw-msg-in">${renderMessageContent(msgs[i])}</div>`;
                    lastTime = msgs[i].sentAt;
                    i++;
                }
                output += `<div class="sw-msg-time">${lastTime ? formatTime(lastTime) : ""}</div>`;
                output += '</div>';
            }
        }
        this.elMessages.innerHTML = output;
    }

    _scrollToBottom(force = false) {
        const el = this.elBody;
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (!force && !isNearBottom) return;
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
    }

    _updateBadge() {
        if (this.unread > 0) {
            this.badge.textContent = this.unread > 9 ? "9+" : String(this.unread);
            this.badge.classList.add("visible");
            this.fab.classList.add("has-unread");
        } else {
            this.badge.classList.remove("visible");
            this.fab.classList.remove("has-unread");
        }
    }

    _updateStatus() {
        if (!this.elStatus) return;

        if (this._status === "connected") {
            this.elStatus.className = "sw-status hidden";
            this._connectionError = false;
            this._reconnectAttempts = 0;
            this._removeErrorMessages();
        } else if (this._status === "connecting") {
            this.elStatus.className = "sw-status connecting";
            this.elStatus.textContent = "Conectando…";
            this._showReconnectBar = false;
        } else {
            this.elStatus.className = "sw-status disconnected";
            this.elStatus.textContent = "Desconectado — Reintentando…";
            this._reconnectAttempts++;
            this._showConnectionError();
        }
    }

    _showConnectionError() {
        if (this.popup.querySelector("#sw-connection-error")) return;
        
        this._connectionError = true;

        const errorDiv = document.createElement("div");
        errorDiv.className = "sw-error-message";
        errorDiv.id = "sw-connection-error";

        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            errorDiv.innerHTML = '⚠️ No se pudo conectar al servidor. <button class="sw-reconnect-btn">Reintentar manualmente</button>';
        } else {
            errorDiv.innerHTML = `⚠️ Problemas de conexión. Reintentando (${this._reconnectAttempts}/${this._maxReconnectAttempts})...`;
        }

        this.popup.querySelector(".sw-header").insertAdjacentElement("afterend", errorDiv);

        const btn = errorDiv.querySelector(".sw-reconnect-btn");
        if (btn) btn.addEventListener("click", () => this._forceReconnect());
    }

    _removeErrorMessages() {
        const err = this.popup.querySelector("#sw-connection-error");
        if (err) err.remove();
        this._connectionError = false;
    }

    _forceReconnect() {
        this._removeErrorMessages();
        this._reconnectAttempts = 0;
        this._connected = false;

        if (this.signalr) {
            try { this.signalr.stop(); } catch {}
        }

        this.signalr = null;
        this._connect();
    }

    _emit(event, data) {
        const listeners = this._listeners[event];
        if (listeners) {
            listeners.forEach(cb => {
                try { cb(data); } catch (e) {}
            });
        }
    }

    // Public API
    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.unread = 0;
        this._updateBadge();
        this.fab.classList.add("open");
        this.popup.classList.add("visible");
        this.elInput.focus();
        this._connect();
        this._scrollToBottom(true);
        this._emit("open");
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.fab.classList.remove("open");
        this.popup.classList.remove("visible");
        this.fab.focus();
        this._emit("close");
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    destroy() {
        if (this.signalr) {
            try { this.signalr.stop(); } catch {}
            this.signalr = null;
        }

        if (this.shadow) {
            this.shadow.innerHTML = "";
        }

        if (this.host && this.host.parentNode) {
            this.host.parentNode.removeChild(this.host);
        }

        this._listeners = {};
    }

    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    }

    setCredentials(userName, password, senderIdentifier) {
        if (!userName || !password || !senderIdentifier) return;
        setWidgetCredentials(userName, password);
        this.senderIdentifier = senderIdentifier;
        this._userSet = true;
        this.host.style.display = "";
        this._emit("credentialsSet", { senderIdentifier });
    }

    setUser(userName, empresa) {
        if (!userName || !empresa) return;
        this.senderIdentifier = userName;
        this._senderCompany = empresa;
        this._userSet = true;
        this.host.style.display = "";
        this.elInput.disabled = false;
        this.elInput.placeholder = "Escribe un mensaje…";
        this._emit("userSet", { userName, empresa });
    }

    forceReconnect() {
        this._forceReconnect();
    }
}
