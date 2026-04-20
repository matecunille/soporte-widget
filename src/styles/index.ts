/**
 * styles/index.ts
 *
 * Main style generator that combines all CSS modules.
 */

import type { WidgetConfig } from '../types.js';
import { generateBaseStyles } from './base.js';
import { generateComponentStyles } from './components.js';
import { generateMobileStyles } from './mobile.js';
import { animationKeyframes } from './animations.js';

export function generateStyles(config: WidgetConfig): string {
    const primaryRgb = config.primaryColor.replace('#', '');
    const expandedRgb = primaryRgb.length === 3
        ? `${primaryRgb[0]!}${primaryRgb[0]!}${primaryRgb[1]!}${primaryRgb[1]!}${primaryRgb[2]!}${primaryRgb[2]!}`
        : primaryRgb;

    return [
        animationKeyframes,
        generateBaseStyles(config, expandedRgb),
        generateComponentStyles(config, expandedRgb),
        generateMobileStyles(config)
    ].join('\n');
}
