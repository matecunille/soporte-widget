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
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.sw-fab:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}

.sw-fab.open {
    transform: scale(0.9);
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
    transition: opacity 0.2s ease;
}

.sw-badge.visible {
    opacity: 1;
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
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: calc(var(--sw-z-index) - 1);
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    pointer-events: none;
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.sw-popup.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
}
`;
}

function hexToRgb(hex: string): string {
    const num = parseInt(hex, 16);
    return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}
