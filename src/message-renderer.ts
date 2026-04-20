/**
 * message-renderer.ts
 *
 * Message rendering logic extracted from ui-manager.ts.
 * Pure template generation — no DOM state, no side effects.
 */

import { escapeHtml, formatTime } from './utils.js';
import type { WidgetConfig, Message, Attachment } from './types.js';
import { FILE_KIND_IMAGE, FILE_KIND_PDF } from './attachments.js';
import { fileIconSvg } from './styles/icons.js';

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
            html += `<div class="sw-msg-text">${escapeHtml(msg.content)}</div>`;
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

        const fileLabel = attachment.kind === FILE_KIND_PDF ? 'Descargar PDF' : 'Descargar archivo';
        const fileIcon = attachment.kind === FILE_KIND_PDF ? 'PDF' : fileIconSvg;

        return `
            <a class="sw-msg-file sw-msg-file-${attachment.kind}" 
               href="${escapeHtml(attachmentUrl)}" 
               download="${escapeHtml(attachment.fileName || 'archivo')}" 
               data-url="${escapeHtml(attachmentUrl)}" 
               data-file-name="${escapeHtml(attachment.fileName || 'archivo')}">
                <span class="sw-msg-file-icon">${fileIcon}</span>
                <div class="sw-msg-file-meta">
                    <div class="sw-msg-file-name">${escapeHtml(attachment.fileName || 'Archivo')}</div>
                    <div class="sw-msg-file-action">${fileLabel}</div>
                </div>
            </a>
        `;
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
