/**
 * index.ts
 *
 * Entry point / bootstrap for the Soporte Widget.
 */

import { mergeConfig } from './config.js';
import { UI } from './ui-manager.js';
import type { UserConfig } from './types.js';

function loadSignalR(): Promise<void> {
    const scriptUrl = 'https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.7/signalr.min.js';
    return new Promise((resolve, reject) => {
        if (window.signalR?.HubConnectionBuilder) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${scriptUrl}`));
        document.head.appendChild(script);
    });
}

function initWidget(): void {
    const userConfig: UserConfig = window.SoporteWidgetConfig ?? {};
    const config = mergeConfig(userConfig);

    if (!config.apiUrl) {
        console.error('SoporteWidget: apiUrl es requerido');
        return;
    }

    const widget = new UI(config);

    window.SoporteWidget = {
        open: () => widget.open(),
        close: () => widget.close(),
        toggle: () => widget.toggle(),
        destroy: () => widget.destroy(),
        on: (event, callback) => widget.on(event, callback),
        setUser: (userName, empresa) => widget.setUser(userName, empresa),
        setCredentials: (userName, password, senderIdentifier) =>
            widget.setCredentials(userName, password, senderIdentifier)
    };
}

window.initSoporteWidget = function (): void {
    loadSignalR().then(initWidget).catch((err) => {
        console.error('SoporteWidget: Failed to initialize', err);
    });
};
