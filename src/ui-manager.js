import { ApiClient } from "./api-client.js";
import { SignalRManager } from "./signalr-manager.js";
import { generateStyles, closeIconSvg } from "./styles.js";
import { escapeHtml, formatTime, storageGet, storageSet, storageRemove, playNotificationSound, setWidgetCredentials, STORAGE_CONVERSATION_ID, STORAGE_CONVERSATION_TIMESTAMP } from "./utils.js";

export class UI {
    constructor(config) {
        this.cfg = config;
        this.api = new ApiClient(config);
        this.signalr = null;
        this.messages = [];
        this.isOpen = false;
        this.unread = 0;
        this.conversationId = (() => {
            const id = storageGet(STORAGE_CONVERSATION_ID);
            const ts = storageGet(STORAGE_CONVERSATION_TIMESTAMP);
            if (id && ts) {
                if (Date.now() - parseInt(ts, 10) < 604800000) { // 7 días
                    return id;
                }
                storageRemove(STORAGE_CONVERSATION_ID);
                storageRemove(STORAGE_CONVERSATION_TIMESTAMP);
            }
            return null;
        })() || null;
        this.senderIdentifier = config.senderIdentifier || "";
        this._senderCompany = config.senderCompany || "";
        this._connected = false;
        this._status = "disconnected";
        this._listeners = {};
        this._sending = false;
        this._pendingImages = [];
        this._userSet = false;
        this._connectionError = false;

        // Auto-initialize when credentials + sender identity are supplied in config
        if (config.credentials?.userName && config.credentials?.password) {
            setWidgetCredentials(config.credentials.userName, config.credentials.password);
        }

        if (config.senderName && this.senderIdentifier) {
            this._userSet = true;
        }
        
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
            <div class="sw-img-preview" style="display:none;"></div>
            <div class="sw-footer">
                <button class="sw-attach-btn" aria-label="Adjuntar imagen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>
                <input class="sw-input" type="text" placeholder="Escribe un mensaje…" aria-label="Mensaje" />
                <button class="sw-send-btn" aria-label="Enviar" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
            </div>
            <input class="sw-file-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple style="display:none;" />
            <div class="sw-powered">Powered by <a href="#">Advertys</a></div>
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
        this.elImgPreview = this.popup.querySelector(".sw-img-preview");

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
            const img = e.target.closest(".sw-msg-image");
            if (img) this._openLightbox(img.src);
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
        this.elSendBtn.disabled = !this.elInput.value.trim() && this._pendingImages.length === 0;
    }

    _handleFileSelect(file) {
        const allowed = { "image/jpeg": 1, "image/png": 1, "image/gif": 1, "image/webp": 1 };
        if (!allowed[file.type]) return;
        if (file.size > 5 * 1024 * 1024) return; // 5MB

        this._pendingImages.push({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            file: file,
            localUrl: URL.createObjectURL(file)
        });
        this._showImagePreview();
        this._updateSendButton();
    }

    _showImagePreview() {
        if (this._pendingImages.length === 0) {
            this.elImgPreview.style.display = "none";
            this.elImgPreview.innerHTML = "";
            return;
        }
        this.elImgPreview.innerHTML = this._pendingImages.map(img => `
            <div class="sw-img-preview-item" data-id="${img.id}">
                <img class="sw-img-preview-thumb" src="${img.localUrl}" />
                <button class="sw-img-preview-remove" aria-label="Quitar">×</button>
            </div>
        `).join("");
        this.elImgPreview.style.display = "flex";
        this.elImgPreview.querySelectorAll(".sw-img-preview-remove").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.closest(".sw-img-preview-item").dataset.id;
                this._removePendingImage(id);
            });
        });
    }

    _clearPendingImages(revoke = true) {
        if (revoke) {
            this._pendingImages.forEach(img => URL.revokeObjectURL(img.localUrl));
        }
        this._pendingImages = [];
        this.elImgPreview.style.display = "none";
        this.elImgPreview.innerHTML = "";
        this._updateSendButton();
    }

    _removePendingImage(id) {
        const idx = this._pendingImages.findIndex(img => img.id === id);
        if (idx !== -1) {
            URL.revokeObjectURL(this._pendingImages[idx].localUrl);
            this._pendingImages.splice(idx, 1);
        }
        this._showImagePreview();
        this._updateSendButton();
    }

    _openLightbox(src) {
        const lightbox = document.createElement("div");
        lightbox.className = "sw-lightbox";
        lightbox.innerHTML = `<img src="${src}" />`;
        lightbox.addEventListener("click", () => lightbox.remove());
        this.shadow.appendChild(lightbox);
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
                // Avoid duplicates (e.g. optimistic message already rendered)
                if (this.messages.some(m =>
                    m.content === content &&
                    Math.abs(new Date(m.sentAt) - new Date(sentAt)) < 2000 &&
                    m.isFromLead === isFromLead &&
                    JSON.stringify(m.attachments) === JSON.stringify(attachments)
                )) return;

                const msg = {
                    content,
                    sentAt,
                    isFromLead,
                    attachments: (attachments || []).map(a => ({
                        imageUrl: this._resolveUrl(a.imageUrl),
                        fileName: a.fileName
                    }))
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

        const historyPromise = this.conversationId
            ? this.api.loadHistory(this.conversationId).then(msgs => {
                this.messages = (msgs || []).map(m => {
                    let content = m.content || m.Content || "";
                    if (typeof content === "object" && content !== null) {
                        content = content.content || content.Content || JSON.stringify(content);
                    }
                    const attachments = (m.attachments || []).map(a => ({
                        imageUrl: this._resolveUrl(a.sasUrl || a.imageUrl || a.url),
                        fileName: a.fileName,
                        contentType: a.contentType
                    }));
                    return {
                        content: String(content),
                        sentAt: m.sentAt || m.SentAt,
                        isFromLead: m.isFromLead !== undefined ? m.isFromLead : m.IsFromLead,
                        attachments: attachments
                    };
                });
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
        if (!this._userSet) return;

        const text = this.elInput.value.trim();
        const pending = [...this._pendingImages];
        if (!text && pending.length === 0) return;
        if (this._sending) return;

        if (!this.signalr || this._status !== "connected") {
            console.warn("No conectado, no se envía el mensaje");
            return;
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
            attachments: pending.map(p => ({ imageUrl: p.localUrl, fileName: p.file.name, temp: true })),
            _blobUrls: pending.map(p => p.localUrl)
        };
        this.messages.push(optimisticMsg);
        this._renderMessages();
        this._scrollToBottom(true);

        this.api.sendMessage(
            text,
            this.senderIdentifier,
            this.cfg.senderName,
            this.conversationId,
            pending.map(p => p.file),
            this._senderCompany,
            window.location.href
        )
        .then(res => {
            const newConvId = res.conversationId;
            if (newConvId && this.conversationId !== String(newConvId)) {
                this.conversationId = String(newConvId);
                storageSet(STORAGE_CONVERSATION_ID, this.conversationId);
                storageSet(STORAGE_CONVERSATION_TIMESTAMP, Date.now().toString());
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
            this._clearPendingImages(false);
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
            attachments: serverAttachments.map((a, i) => ({
                imageUrl: this._resolveUrl(a.sasUrl || a.imageUrl || a.url),
                fileName: a.fileName || oldMsg.attachments[i]?.fileName
            }))
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

        const renderMessageContent = (msg) => {
            let html = "";
            const attachments = msg.attachments || [];
            for (let a of attachments) {
                if (a.imageUrl) {
                    html += `<img class="sw-msg-image" src="${escapeHtml(a.imageUrl)}" alt="${escapeHtml(a.fileName || "imagen")}" />`;
                }
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

    setCredentials(userName, password, senderName, senderIdentifier) {
        if (!userName || !password || !senderName || !senderIdentifier) return;
        setWidgetCredentials(userName, password);
        this.cfg.senderName = senderName;
        this.senderIdentifier = senderIdentifier;
        this._userSet = true;
        this.host.style.display = "";
        this._emit("credentialsSet", { senderName, senderIdentifier });
    }

    setUser(userName, empresa) {
        if (!userName || !empresa) return;
        this.cfg.senderName = userName;
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