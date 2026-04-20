/**
 * viewport.ts
 *
 * Mobile viewport management — compensates for the iOS virtual keyboard
 * shrinking the visual viewport.
 */

import type { ViewportContext } from './types.js';

/**
 * Returns true when the current window width matches the mobile breakpoint.
 */
function isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 480px)').matches;
}

/**
 * Reads the current visual viewport dimensions and writes them as CSS custom
 * properties onto the popup element.
 */
export function updateMobileViewportLayout(
    popup: HTMLElement | null,
    ctx: ViewportContext,
    forceScroll = false,
    onScrollNeeded?: () => void
): void {
    if (!popup) return;

    if (!isMobileViewport()) {
        popup.style.removeProperty('--sw-mobile-viewport-height');
        popup.style.removeProperty('--sw-mobile-offset-top');
        return;
    }

    const visualViewport = window.visualViewport ?? null;
    const height = visualViewport ? Math.round(visualViewport.height) : window.innerHeight;
    const offsetTop = visualViewport ? Math.max(0, Math.round(visualViewport.offsetTop)) : 0;

    popup.style.setProperty('--sw-mobile-viewport-height', `${height}px`);
    popup.style.setProperty('--sw-mobile-offset-top', `${offsetTop}px`);

    if (ctx.isOpen && (forceScroll || ctx.shadowRoot?.activeElement === ctx.inputEl)) {
        onScrollNeeded?.();
    }
}

interface ViewportBinding {
    scheduledUpdate: (forceScroll?: boolean) => void;
    unbind: () => void;
}

/**
 * Binds all viewport resize/scroll event listeners needed for mobile keyboard
 * compensation and returns a cleanup function.
 */
export function bindViewportEvents(
    popup: HTMLElement | null,
    ctx: ViewportContext,
    onScrollNeeded: () => void
): ViewportBinding {
    const visualViewport = window.visualViewport ?? null;
    let tick: number | null = null;

    function schedule(forceScroll = false): void {
        if (tick !== null) cancelAnimationFrame(tick);
        tick = requestAnimationFrame(() => {
            tick = null;
            updateMobileViewportLayout(popup, ctx, forceScroll, onScrollNeeded);
        });
    }

    const onViewportChange = () => schedule(true);
    const onWindowResize = () => schedule();

    if (visualViewport) {
        visualViewport.addEventListener('resize', onViewportChange);
        visualViewport.addEventListener('scroll', onViewportChange);
    }
    window.addEventListener('resize', onWindowResize);

    // Run once on bind to set initial values
    updateMobileViewportLayout(popup, ctx, false, onScrollNeeded);

    function unbind(): void {
        if (visualViewport) {
            visualViewport.removeEventListener('resize', onViewportChange);
            visualViewport.removeEventListener('scroll', onViewportChange);
        }
        window.removeEventListener('resize', onWindowResize);
        if (tick !== null) {
            cancelAnimationFrame(tick);
            tick = null;
        }
    }

    return { scheduledUpdate: schedule, unbind };
}
