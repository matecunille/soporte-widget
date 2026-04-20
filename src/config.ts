/**
 * config.ts
 *
 * Widget configuration defaults and merge logic.
 */

import type { WidgetConfig, UserConfig } from './types.js';

export const defaultConfig: WidgetConfig = {
    apiUrl: '',
    clientId: '',
    title: 'Soporte',
    subtitle: 'Chat con nuestro equipo',
    primaryColor: '#FE7109',
    position: 'right',
    senderIdentifier: '',
    credentials: null,
    senderCompany: '',
    welcomeMessage: 'Hola, ¿en qué podemos ayudarte?',
    avatarImage: '',
    avatarLetter: 'S',
    agentName: 'Soporte',
    soundEnabled: true,
    zIndex: 9999,
    productName: ''
};

export function mergeConfig(userConfig: UserConfig = {}): WidgetConfig {
    const config = { ...defaultConfig };
    
    for (const key in userConfig) {
        if (Object.prototype.hasOwnProperty.call(userConfig, key)) {
            const k = key as keyof WidgetConfig;
            const value = userConfig[k];
            if (value !== undefined) {
                // Type-safe assignment
                (config as Record<string, unknown>)[k] = value;
            }
        }
    }
    
    return config;
}
