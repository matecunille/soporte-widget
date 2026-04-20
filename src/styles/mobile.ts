/**
 * styles/mobile.ts
 *
 * Mobile-specific and responsive styles.
 */

import type { WidgetConfig } from '../types.js';

export function generateMobileStyles(config: WidgetConfig): string {
    return `
@media (max-width: 480px) {
    .sw-fab {
        width: 48px;
        height: 48px;
        bottom: 16px;
        ${config.position === 'left' ? 'left: 16px;' : 'right: 16px;'}
    }

    .sw-fab svg {
        width: 22px;
        height: 22px;
    }

    .sw-popup {
        position: fixed;
        inset: auto 0 0 0;
        width: 100%;
        max-width: 100%;
        height: var(--sw-mobile-viewport-height, 100dvh);
        max-height: 100dvh;
        border-radius: 16px 16px 0 0;
        bottom: 0;
        ${config.position === 'left' ? '' : ''}
    }

    .sw-popup.visible {
        transform: translateY(0);
    }

    .sw-header {
        padding: 12px 16px;
    }

    .sw-header-avatar {
        width: 36px;
        height: 36px;
    }

    .sw-body {
        padding: 12px;
    }

    .sw-msg-out,
    .sw-msg-in {
        max-width: 90%;
        padding: 8px 12px;
    }

    .sw-msg-file {
        gap: 10px;
        padding: 10px;
    }

    .sw-msg-file-icon {
        width: 42px;
        height: 42px;
        border-radius: 12px;
    }

    .sw-msg-file-badge {
        font-size: 9px;
        padding: 3px 7px;
    }

    .sw-msg-file-caption {
        font-size: 10px;
    }

    .sw-msg-file-name {
        font-size: 13px;
    }

    .sw-msg-file-action {
        font-size: 11px;
    }

    .sw-msg-file-cta {
        width: 28px;
        height: 28px;
    }

    .sw-footer {
        padding: 10px 12px;
    }

    .sw-attachment-preview {
        padding: 10px 12px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .sw-fab,
    .sw-popup,
    .sw-msg-image,
    .sw-send-btn,
    .sw-attach-btn,
    .sw-msg-out,
    .sw-msg-in,
    .sw-attachment-preview-item,
    .sw-welcome,
    .sw-welcome-icon,
    .sw-welcome-title,
    .sw-welcome-text,
    .sw-badge,
    .sw-typing-indicator,
    .sw-attachment-preview-thumb {
        transition: none !important;
        animation: none !important;
        transform: none !important;
    }
    
    .sw-popup.visible {
        filter: none;
    }
}
`;
}
