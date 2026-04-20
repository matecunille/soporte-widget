/**
 * styles/base.ts
 *
 * CSS variables, reset, and base styles.
 */

import type { WidgetConfig } from '../types.js';

export function generateBaseStyles(config: WidgetConfig, primaryRgb: string): string {
    const position = config.position === 'left' ? 'left: 20px;' : 'right: 20px;';

    return `
:host {
    --sw-primary: ${config.primaryColor};
    --sw-primary-rgb: ${hexToRgb(primaryRgb)};
    --sw-z-index: ${config.zIndex};
    ${position}
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

.sw-fab {
    position: fixed;
    bottom: 20px;
    ${position}
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--sw-primary);
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--sw-z-index);
    animation: sw-fab-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sw-fab:hover {
    transform: scale(1.08) rotate(5deg);
    box-shadow: 0 8px 24px rgba(0,0,0,0.2), 0 0 0 3px rgba(var(--sw-primary-rgb), 0.15);
}

.sw-fab.open {
    transform: scale(0.9) rotate(90deg);
}

.sw-fab.has-unread {
    animation: sw-fab-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
               sw-fab-pulse 2s ease-in-out infinite 0.6s;
}

.sw-icon-chat,
.sw-icon-close {
    width: 24px;
    height: 24px;
    color: white;
}

.sw-fab .sw-icon-close {
    display: none;
}

.sw-fab.open .sw-icon-chat {
    display: none;
}

.sw-fab.open .sw-icon-close {
    display: block;
}

.sw-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ff4444;
    color: white;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: scale(0);
    transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sw-badge.visible {
    opacity: 1;
    transform: scale(1);
    animation: sw-badge-bounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s;
}

.sw-popup {
    position: fixed;
    bottom: 88px;
    ${position}
    width: 380px;
    max-width: calc(100vw - 40px);
    height: 600px;
    max-height: calc(100vh - 120px);
    background: white;
    border-radius: 20px;
    box-shadow: 0 12px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: calc(var(--sw-z-index) - 1);
    opacity: 0;
    transform: translateY(30px) scale(0.92);
    pointer-events: none;
    transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
                transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                filter 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    filter: blur(8px);
}

.sw-popup.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
    filter: blur(0);
    animation: sw-popup-bloom 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
`;
}

function hexToRgb(hex: string): string {
    const num = parseInt(hex, 16);
    return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}
