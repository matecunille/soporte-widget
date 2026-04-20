/**
 * styles/animations.ts
 *
 * Keyframe animations and motion design system.
 * Fluid, modern micro-interactions with spring physics.
 */

export const animationKeyframes = `
/* Message entrance animations */
@keyframes sw-msg-pop-in {
    0% {
        opacity: 0;
        transform: translateY(20px) scale(0.9);
    }
    70% {
        transform: translateY(-4px) scale(1.02);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@keyframes sw-msg-slide-in-right {
    0% {
        opacity: 0;
        transform: translateX(30px) scale(0.95);
    }
    60% {
        transform: translateX(-4px) scale(1.01);
    }
    100% {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}

@keyframes sw-msg-slide-in-left {
    0% {
        opacity: 0;
        transform: translateX(-30px) scale(0.95);
    }
    60% {
        transform: translateX(4px) scale(1.01);
    }
    100% {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}

/* FAB animations */
@keyframes sw-fab-entrance {
    0% {
        opacity: 0;
        transform: scale(0) rotate(-180deg);
    }
    50% {
        transform: scale(1.1) rotate(0deg);
    }
    100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
    }
}

@keyframes sw-fab-pulse {
    0%, 100% {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    50% {
        box-shadow: 0 4px 20px rgba(0,0,0,0.25), 0 0 0 4px rgba(var(--sw-primary-rgb), 0.2);
    }
}

@keyframes sw-badge-bounce {
    0%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.2);
    }
}

/* Typing indicator */
@keyframes sw-typing-bounce {
    0%, 60%, 100% {
        transform: translateY(0);
    }
    30% {
        transform: translateY(-6px);
    }
}

/* Send button effects */
@keyframes sw-send-ripple {
    0% {
        transform: scale(1);
        opacity: 0.5;
    }
    100% {
        transform: scale(2.5);
        opacity: 0;
    }
}

@keyframes sw-send-success {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(0.9);
    }
    100% {
        transform: scale(1);
    }
}

/* Status transitions */
@keyframes sw-status-fade-in {
    0% {
        opacity: 0;
        transform: translateY(-10px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes sw-status-pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.6;
    }
}

/* Attachment animations */
@keyframes sw-attachment-slide-in {
    0% {
        opacity: 0;
        transform: translateX(-20px) scale(0.9);
    }
    100% {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}

@keyframes sw-attachment-preview-pop {
    0% {
        opacity: 0;
        transform: scale(0.8) translateY(10px);
    }
    70% {
        transform: scale(1.05) translateY(-2px);
    }
    100% {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

/* Popup entrance */
@keyframes sw-popup-bloom {
    0% {
        opacity: 0;
        transform: translateY(30px) scale(0.9);
        filter: blur(4px);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0);
    }
}

/* Welcome screen */
@keyframes sw-welcome-fade-up {
    0% {
        opacity: 0;
        transform: translateY(30px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes sw-welcome-icon-float {
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-8px);
    }
}

/* Error shake */
@keyframes sw-error-shake {
    0%, 100% {
        transform: translateX(0);
    }
    10%, 30%, 50%, 70%, 90% {
        transform: translateX(-4px);
    }
    20%, 40%, 60%, 80% {
        transform: translateX(4px);
    }
}

/* Loading spinner */
@keyframes sw-spinner-rotate {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

/* Image load */
@keyframes sw-image-reveal {
    0% {
        opacity: 0;
        transform: scale(0.95);
        filter: blur(8px);
    }
    100% {
        opacity: 1;
        transform: scale(1);
        filter: blur(0);
    }
}
`;

// Animation timing constants
export const animationTimings = {
    // Spring physics for natural feel
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    // Smooth deceleration
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Ease out for exits
    exit: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    // Quick interactions
    quick: 'cubic-bezier(0.4, 0, 1, 1)',
    // Bouncy for playful elements
    bouncy: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
};
