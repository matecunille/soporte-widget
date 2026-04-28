/**
 * styles/components.ts
 *
 * Component-specific styles: header, messages, footer, attachments.
 */

import type { WidgetConfig } from '../types.js';

export function generateComponentStyles(_config: WidgetConfig, _primaryRgb: string): string {
    return `
/* Header */
.sw-header {
    padding: 16px;
    background: var(--sw-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.sw-header-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.sw-header-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    position: relative;
}

.sw-header-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

.sw-header-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #00c853;
    border: 2px solid var(--sw-primary);
}

.sw-header-text {
    display: flex;
    flex-direction: column;
}

.sw-header-title {
    font-weight: 600;
    font-size: 15px;
}

.sw-header-subtitle {
    font-size: 12px;
    opacity: 0.9;
}

.sw-btn-close {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.8;
    transition: opacity 0.2s ease;
}

.sw-btn-close:hover {
    opacity: 1;
}

/* Status bar */
.sw-status {
    padding: 8px 16px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.sw-status.hidden {
    display: none;
}

.sw-status.connecting {
    background: #fff8e1;
    color: #f57c00;
}

.sw-status.disconnected {
    background: #ffebee;
    color: #c62828;
}

/* Messages area */
.sw-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #f5f5f5;
}

.sw-messages {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.sw-welcome {
    text-align: center;
    padding: 40px 20px;
    animation: sw-welcome-fade-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.sw-welcome-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--sw-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 600;
    margin: 0 auto 16px;
    animation: sw-welcome-icon-float 3s ease-in-out infinite;
    box-shadow: 0 4px 16px rgba(var(--sw-primary-rgb), 0.3);
}

.sw-welcome-icon img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

.sw-welcome-title {
    font-weight: 600;
    font-size: 18px;
    color: #333;
    margin-bottom: 8px;
    opacity: 0;
    animation: sw-welcome-fade-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
}

.sw-welcome-text {
    font-size: 14px;
    color: #666;
    opacity: 0;
    animation: sw-welcome-fade-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards;
}

/* Message groups */
.sw-msg-out-group,
.sw-msg-in-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.sw-msg-out-group {
    align-items: flex-end;
}

.sw-msg-out-group.sw-animate-in {
    animation: sw-msg-slide-in-right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.sw-msg-in-group {
    align-items: flex-start;
}

.sw-msg-in-group.sw-animate-in {
    animation: sw-msg-slide-in-left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.sw-msg-sender {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
    padding-left: 4px;
}

.sw-msg-out,
.sw-msg-in {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.4;
    word-wrap: break-word;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sw-msg-out {
    background: var(--sw-primary);
    color: white;
    border-bottom-right-radius: 4px;
    box-shadow: 0 2px 8px rgba(var(--sw-primary-rgb), 0.25);
}

.sw-msg-out:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 4px 12px rgba(var(--sw-primary-rgb), 0.35);
}

.sw-msg-in {
    background: white;
    color: #333;
    border-bottom-left-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.sw-msg-in:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}

.sw-msg-time {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
}

.sw-msg-out-group .sw-msg-time {
    text-align: right;
    padding-right: 4px;
}

.sw-msg-in-group .sw-msg-time {
    padding-left: 4px;
}

.sw-msg-text {
    margin-bottom: 4px;
}

.sw-msg-text:last-child {
    margin-bottom: 0;
}

.sw-msg-error {
    font-size: 12px;
    color: #c62828;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
}

/* Message images */
.sw-msg-image {
    max-width: 100%;
    max-height: 200px;
    border-radius: 12px;
    cursor: pointer;
    transition: transform 0.2s ease;
}

.sw-msg-image:hover {
    transform: scale(1.02);
}

/* Message file attachments — clean row with type pill */
.sw-msg-file {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    font-size: 13px;
    max-width: 100%;
    margin-bottom: 4px;
    transition: background 0.2s ease, border-color 0.2s ease;
}

.sw-msg-file:hover {
    background: rgba(0, 0, 0, 0.08);
    border-color: rgba(0, 0, 0, 0.12);
}

.sw-msg-file-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(var(--sw-primary-rgb), 0.12);
    color: var(--sw-primary);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    flex-shrink: 0;
}

.sw-msg-file-pdf .sw-msg-file-badge {
    background: rgba(220, 38, 38, 0.12);
    color: #dc2626;
}

.sw-msg-file-ext-xlsx .sw-msg-file-badge,
.sw-msg-file-ext-xls .sw-msg-file-badge {
    background: rgba(22, 163, 74, 0.12);
    color: #16a34a;
}

.sw-msg-file-ext-docx .sw-msg-file-badge {
    background: rgba(37, 99, 235, 0.12);
    color: #2563eb;
}

.sw-msg-file-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
    flex: 1;
    min-width: 0;
}

.sw-msg-file-download {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    color: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, color 0.2s ease;
}

.sw-msg-file-download svg {
    width: 100%;
    height: 100%;
}

.sw-msg-file:hover .sw-msg-file-download {
    transform: translateX(2px);
    color: rgba(0, 0, 0, 0.7);
}

/* Outgoing message variant — light card on colored bubble */
.sw-msg-out .sw-msg-file {
    background: rgba(255, 255, 255, 0.92);
    border-color: rgba(255, 255, 255, 0.95);
    color: #1f2937;
}

.sw-msg-out .sw-msg-file:hover {
    background: #ffffff;
    border-color: #ffffff;
}

.sw-msg-out .sw-msg-file-download {
    color: rgba(0, 0, 0, 0.4);
}

.sw-msg-out .sw-msg-file:hover .sw-msg-file-download {
    color: rgba(0, 0, 0, 0.7);
}

/* Outgoing badge colors (same as incoming, visible on white card) */
.sw-msg-out .sw-msg-file-pdf .sw-msg-file-badge {
    background: rgba(220, 38, 38, 0.12);
    color: #dc2626;
}

.sw-msg-out .sw-msg-file-ext-xlsx .sw-msg-file-badge,
.sw-msg-out .sw-msg-file-ext-xls .sw-msg-file-badge {
    background: rgba(22, 163, 74, 0.12);
    color: #16a34a;
}

.sw-msg-out .sw-msg-file-ext-docx .sw-msg-file-badge {
    background: rgba(37, 99, 235, 0.12);
    color: #2563eb;
}

/* ============================================
   ATTACHMENT PREVIEW - Editorial Card Design
   ============================================ */

/* Preview Container - Warm Gallery Feel */
.sw-attachment-preview {
    padding: 16px 20px;
    background: linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%);
    border-top: 1px solid rgba(0,0,0,0.06);
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    max-height: 140px;
    overflow-y: auto;
    position: relative;
}

.sw-attachment-preview::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(254,113,9,0.2) 50%, transparent 100%);
}

/* Preview Item Cards */
.sw-attachment-preview-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: white;
    border-radius: 12px;
    border: 1px solid rgba(0,0,0,0.08);
    animation: sw-attachment-preview-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.sw-attachment-preview-item:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    border-color: rgba(254,113,9,0.2);
}

/* Image Preview - Intact */
.sw-attachment-preview-thumb {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    object-fit: cover;
    animation: sw-image-reveal 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* File Preview - Editorial Card Style */
.sw-preview-file {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 180px;
}

.sw-preview-file-icon {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border: 2px solid rgba(0,0,0,0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    overflow: hidden;
}

.sw-preview-file-icon::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #FE7109 0%, #ff8c42 100%);
    opacity: 0.8;
}

.sw-preview-file-icon svg {
    width: 28px;
    height: 28px;
    color: #495057;
    transition: all 0.3s ease;
}

.sw-preview-file:hover .sw-preview-file-icon {
    transform: scale(1.05) rotate(-3deg);
    border-color: rgba(254,113,9,0.3);
    box-shadow: 0 4px 12px rgba(254,113,9,0.15);
}

.sw-preview-file:hover .sw-preview-file-icon svg {
    color: #FE7109;
    transform: scale(1.1);
}

/* PDF Specific Styling */
.sw-preview-file-pdf .sw-preview-file-icon {
    background: linear-gradient(135deg, rgba(var(--sw-primary-rgb), 0.06) 0%, rgba(var(--sw-primary-rgb), 0.12) 100%);
    border-color: rgba(var(--sw-primary-rgb), 0.2);
}

.sw-preview-file-pdf .sw-preview-file-icon::before {
    background: linear-gradient(90deg, var(--sw-primary) 0%, rgba(var(--sw-primary-rgb), 0.7) 100%);
}

.sw-preview-file-pdf:hover .sw-preview-file-icon {
    border-color: rgba(var(--sw-primary-rgb), 0.4);
    box-shadow: 0 4px 12px rgba(var(--sw-primary-rgb), 0.15);
}

.sw-preview-file-pdf .sw-preview-file-icon svg,
.sw-preview-file-pdf .sw-preview-file-icon {
    color: var(--sw-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
}

/* File Metadata */
.sw-preview-file-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.sw-preview-file-name {
    font-weight: 600;
    font-size: 13px;
    color: #212529;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
}

.sw-preview-file-type {
    font-size: 11px;
    color: #6c757d;
    font-weight: 500;
    letter-spacing: 0.3px;
    text-transform: uppercase;
}

/* Remove Button - Refined */
.sw-attachment-preview-remove {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ff4444;
    color: white;
    border: 2px solid white;
    padding: 0;
    margin: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 10;
}

.sw-attachment-preview-remove svg {
    width: 12px;
    height: 12px;
    display: block;
    stroke-width: 2.5;
}

.sw-attachment-preview-remove:hover {
    transform: scale(1.15) rotate(90deg);
    background: #d32f2f;
    box-shadow: 0 4px 12px rgba(211,47,47,0.3);
}

.sw-attachment-preview-remove:active {
    transform: scale(0.95);
}

.sw-attachment-validation {
    padding: 8px 16px;
    background: #ffebee;
    color: #c62828;
    font-size: 12px;
}

.sw-attachment-validation.hidden {
    display: none;
}

/* Footer */
.sw-footer {
    padding: 12px 16px;
    background: white;
    border-top: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    gap: 12px;
}

.sw-attach-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: #f5f5f5;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    flex-shrink: 0;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sw-attach-btn:hover {
    background: var(--sw-primary);
    color: white;
    transform: scale(1.1) rotate(-10deg);
    box-shadow: 0 4px 12px rgba(var(--sw-primary-rgb), 0.3);
}

.sw-attach-btn:active {
    transform: scale(0.95) rotate(-5deg);
}

.sw-attach-btn svg {
    width: 20px;
    height: 20px;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sw-attach-btn:hover svg {
    transform: rotate(15deg);
}

.sw-input {
    flex: 1;
    border: none;
    background: #f5f5f5;
    padding: 10px 14px;
    border-radius: 20px;
    font-size: 14px;
    outline: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sw-input:focus {
    background: #eeeeee;
}

/* Typing indicator */
.sw-typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
    background: white;
    border-radius: 18px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    width: fit-content;
    animation: sw-msg-slide-in-left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sw-typing-indicator span {
    width: 8px;
    height: 8px;
    background: var(--sw-primary);
    border-radius: 50%;
    opacity: 0.4;
    animation: sw-typing-bounce 1.4s ease-in-out infinite;
}

.sw-typing-indicator span:nth-child(1) {
    animation-delay: -0.32s;
}

.sw-typing-indicator span:nth-child(2) {
    animation-delay: -0.16s;
}

.sw-typing-indicator span:nth-child(3) {
    animation-delay: 0s;
}

.sw-send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--sw-primary);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    overflow: hidden;
}

.sw-send-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.sw-send-btn:hover:not(:disabled) {
    transform: scale(1.12);
    box-shadow: 0 4px 16px rgba(var(--sw-primary-rgb), 0.4);
}

.sw-send-btn:hover:not(:disabled)::before {
    opacity: 1;
}

.sw-send-btn:active:not(:disabled) {
    transform: scale(0.95);
}

.sw-send-btn.sending {
    animation: sw-send-success 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sw-send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: scale(0.95);
}

.sw-send-btn svg {
    width: 18px;
    height: 18px;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    /* Compensate for paper-plane visual weight shift (top-right heavy) */
    transform: translate(-1px, 1px);
}

.sw-send-btn:hover:not(:disabled) svg {
    transform: translate(1px, 0);
}

.sw-file-input {
    display: none;
}

.sw-powered {
    padding: 8px 16px;
    text-align: center;
    font-size: 11px;
    color: #999;
    background: white;
    border-top: 1px solid #e0e0e0;
}

.sw-powered a {
    color: var(--sw-primary);
    text-decoration: none;
}

/* Error message */
.sw-error-message {
    padding: 12px 16px;
    background: #ffebee;
    color: #c62828;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.sw-reconnect-btn {
    padding: 6px 12px;
    background: #c62828;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
}

.sw-reconnect-btn:hover {
    background: #b71c1c;
}

/* Lightbox */
.sw-lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: calc(var(--sw-z-index) + 10);
    cursor: zoom-out;
}

.sw-lightbox img {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
}

/* Animations */
@keyframes sw-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}

.sw-fab.has-unread .sw-fab-ring {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid #ff4444;
    animation: sw-pulse 2s infinite;
}
`;
}
