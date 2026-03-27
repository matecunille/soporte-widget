import { fetchWidgetToken } from "./utils.js";

export class SignalRManager {
    constructor(config, onMessage, onStatusChange) {
        this._hubUrl = config.apiUrl.replace(/\/+$/, "") + "/hubs/widget";
        this.connection = null;
        this.onMessage = onMessage;
        this.onStatusChange = onStatusChange;
        this._conversationId = null;
    }

    async start(conversationId) {
        this._conversationId = conversationId;

        if (!window.signalR) {
            this.onStatusChange("disconnected");
            return Promise.reject(new Error("SignalR not loaded"));
        }

        const token = await fetchWidgetToken(this._hubUrl.replace("/hubs/widget", ""));

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(this._hubUrl, { accessTokenFactory: () => token })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .build();
        
        this.connection.serverTimeoutInMilliseconds = 60000;
        this.connection.keepAliveIntervalInMilliseconds = 15000;

        this.connection.on("RecibirRespuesta", (content, sentAt, attachments) => {
            const mapped = (attachments || []).map(a => ({ imageUrl: a.url, fileName: a.fileName }));
            this.onMessage(content, sentAt, mapped, false);
        });

        this.connection.on("RecibirMensajeWidget", (content, sentAt, attachments) => {
            const mapped = (attachments || []).map(a => ({ imageUrl: a.url, fileName: a.fileName }));
            this.onMessage(content, sentAt, mapped, true);
        });

        this.connection.onreconnecting(() => this.onStatusChange("disconnected"));
        this.connection.onreconnected(() => {
            this.onStatusChange("connected");
            if (this._conversationId) this.joinConversation(this._conversationId);
        });
        this.connection.onclose(() => this.onStatusChange("disconnected"));

        this.onStatusChange("connecting");

        return this.connection.start()
            .then(() => {
                this.onStatusChange("connected");
                if (this._conversationId) return this.joinConversation(this._conversationId);
            })
            .catch(err => {
                this.onStatusChange("disconnected");
                throw err;
            });
    }

    joinConversation(conversationId) {
        this._conversationId = conversationId;
        if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
            return this.connection.invoke("JoinConversation", conversationId);
        }
        return Promise.resolve();
    }

    stop() {
        return this.connection ? this.connection.stop() : Promise.resolve();
    }
}