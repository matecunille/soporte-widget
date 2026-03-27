import { mergeConfig } from "./config.js";
import { UI } from "./ui-manager.js";

function loadSignalR() {
    const scriptUrl = "https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.7/signalr.min.js";
    return new Promise((resolve, reject) => {
        if (window.signalR?.HubConnectionBuilder) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Failed to load " + scriptUrl));
        document.head.appendChild(script);
    });
}

function initWidget() {
    const userConfig = window.SoporteWidgetConfig || {};
    const config = mergeConfig(userConfig);

    if (!config.apiUrl) {
        console.error("SoporteWidget: apiUrl es requerido");
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
        setCredentials: (userName, password, senderName, senderIdentifier) =>
            widget.setCredentials(userName, password, senderName, senderIdentifier)
    };
}

window.initSoporteWidget = function () {
    loadSignalR().then(initWidget);
};