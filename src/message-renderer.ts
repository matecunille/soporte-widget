/**
 * message-renderer.ts
 *
 * Message rendering logic extracted from ui-manager.ts.
 * Pure template generation — no DOM state, no side effects.
 */

import { escapeHtml, formatTime } from './utils.js';
import type { WidgetConfig, Message, Attachment } from './types.js';
import { FILE_KIND_IMAGE, getDisplayName, getFileExtension } from './attachments.js';
import { downloadIconSvg } from './styles/icons.js';

interface RenderOptions {
    welcomeScreen: boolean;
    html: string;
}

export class MessageRenderer {
    private readonly config: WidgetConfig;

    constructor(config: WidgetConfig) {
        this.config = config;
    }

    /**
     * Renders the full message list or welcome screen.
     */
    renderMessages(messages: Message[]): RenderOptions {
        if (messages.length === 0) {
            return {
                welcomeScreen: true,
                html: this.renderWelcomeScreen()
            };
        }

        return {
            welcomeScreen: false,
            html: this.renderMessageGroups(messages)
        };
    }

    /**
     * Renders a single new message for incremental DOM updates.
     */
    renderSingleMessage(message: Message, isStartOfGroup: boolean, isEndOfGroup: boolean, animate: boolean = true): string {
        if (message.isFromLead) {
            let html = '';
            if (isStartOfGroup) {
                const animateClass = animate ? ' sw-animate-in' : '';
                html += `<div class="sw-msg-out-group${animateClass}">`;
            }
            html += `<div class="sw-msg-out">${this.renderMessageContent(message)}</div>`;
            if (isEndOfGroup) {
                html += `<div class="sw-msg-time">${message.sentAt ? formatTime(message.sentAt) : ''}</div>`;
                html += '</div>';
            }
            return html;
        } else {
            let html = '';
            if (isStartOfGroup) {
                const animateClass = animate ? ' sw-animate-in' : '';
                html += `<div class="sw-msg-in-group${animateClass}">`;
                html += `<div class="sw-msg-sender">${escapeHtml(this.config.agentName)}</div>`;
            }
            html += `<div class="sw-msg-in">${this.renderMessageContent(message)}</div>`;
            if (isEndOfGroup) {
                html += `<div class="sw-msg-time">${message.sentAt ? formatTime(message.sentAt) : ''}</div>`;
                html += '</div>';
            }
            return html;
        }
    }

    private renderWelcomeScreen(): string {
        const cfg = this.config;
        return `
            <div class="sw-welcome">
                <div class="sw-welcome-icon">
                    ${cfg.avatarImage 
                        ? `<img src="${escapeHtml(cfg.avatarImage)}" alt="${escapeHtml(cfg.title)}" />` 
                        : escapeHtml(cfg.avatarLetter)}
                </div>
                <div class="sw-welcome-title">${escapeHtml(cfg.title)}</div>
                <div class="sw-welcome-text">${escapeHtml(cfg.welcomeMessage)}</div>
            </div>
        `;
    }

    private renderMessageGroups(messages: Message[]): string {
        let output = '';
        let i = 0;

        while (i < messages.length) {
            const isLead = messages[i]!.isFromLead;
            let lastTime = messages[i]!.sentAt;

            if (isLead) {
                output += '<div class="sw-msg-out-group">';
                while (i < messages.length && messages[i]!.isFromLead) {
                    output += `<div class="sw-msg-out">${this.renderMessageContent(messages[i]!)}</div>`;
                    lastTime = messages[i]!.sentAt;
                    i++;
                }
                output += `<div class="sw-msg-time">${lastTime ? formatTime(lastTime) : ''}</div>`;
                output += '</div>';
            } else {
                output += '<div class="sw-msg-in-group">';
                output += `<div class="sw-msg-sender">${escapeHtml(this.config.agentName)}</div>`;
                while (i < messages.length && !messages[i]!.isFromLead) {
                    output += `<div class="sw-msg-in">${this.renderMessageContent(messages[i]!)}</div>`;
                    lastTime = messages[i]!.sentAt;
                    i++;
                }
                output += `<div class="sw-msg-time">${lastTime ? formatTime(lastTime) : ''}</div>`;
                output += '</div>';
            }
        }

        return output;
    }

    private renderMessageContent(msg: Message): string {
        let html = '';
        const attachments = msg.attachments ?? [];
        
        for (const attachment of attachments) {
            html += this.renderAttachment(attachment);
        }
        
        if (msg.content) {
            // Newlines arrive as literal \n from backend; HTML collapses whitespace.
            // Escape first (XSS prevention), then parse **bold**, then convert \n → <br>.
            let text = escapeHtml(msg.content);
            text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/\n/g, '<br>');
            html += `<div class="sw-msg-text">${text}</div>`;
        }
        
        if (msg.failed) {
            html += '<div class="sw-msg-error">⚠️ Error al enviar</div>';
        }
        
        return html;
    }

    private renderAttachment(attachment: Attachment): string {
        const attachmentUrl = attachment.url || attachment.imageUrl;
        if (!attachmentUrl) return '';

        if (attachment.kind === FILE_KIND_IMAGE) {
            const imageSrc = attachment.imageUrl || attachmentUrl;
            return `<img class="sw-msg-image" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(attachment.fileName || 'imagen')}" />`;
        }

        const fileName = attachment.fileName || 'Archivo';
        const displayName = getDisplayName(fileName);
        const badge = this.getAttachmentBadge(attachment);
        const extClass = this.getExtensionClass(attachment);

        return `
            <a class="sw-msg-file sw-msg-file-${attachment.kind}${extClass}"
               href="${escapeHtml(attachmentUrl)}"
               download="${escapeHtml(fileName)}"
               data-url="${escapeHtml(attachmentUrl)}"
               data-file-name="${escapeHtml(fileName)}"
               aria-label="${escapeHtml(`Descargar: ${fileName}`)}">
                <span class="sw-msg-file-badge">${escapeHtml(badge)}</span>
                <span class="sw-msg-file-name">${escapeHtml(displayName)}</span>
                <span class="sw-msg-file-download" aria-hidden="true">${downloadIconSvg}</span>
            </a>
        `;
    }

    private getAttachmentBadge(attachment: Attachment): string {
        const extension = getFileExtension(attachment.fileName || attachment.url || '');
        return extension ? extension.slice(1).toUpperCase() : 'FILE';
    }

    private getExtensionClass(attachment: Attachment): string {
        const extension = getFileExtension(attachment.fileName || attachment.url || '');
        return extension ? ` sw-msg-file-ext-${extension.slice(1)}` : '';
    }
}

/**
 * Determines if a new message starts a new group (different sender from previous).
 */
export function isStartOfNewGroup(messages: Message[], index: number): boolean {
    if (index === 0) return true;
    return messages[index]!.isFromLead !== messages[index - 1]!.isFromLead;
}

/**
 * Determines if a message is the last in its group.
 */
export function isEndOfGroup(messages: Message[], index: number): boolean {
    if (index === messages.length - 1) return true;
    return messages[index]!.isFromLead !== messages[index + 1]!.isFromLead;
}
