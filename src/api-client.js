import { fetchWidgetToken } from "./utils.js";

export class ApiClient {
    constructor(config) {
        this._base = config.apiUrl.replace(/\/+$/, "");
        this._clientId = config.clientId;
    }

    async _request(url, options = {}) {
        const token = await fetchWidgetToken(this._base);
        const headers = {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            "X-Widget-ClientId": this._clientId
        };
        return fetch(url, { ...options, headers });
    }

    sendMessage(content, senderIdentifier, senderName, conversationId, files, senderCompany, pageUrl) {
        const formData = new FormData();
        formData.append("Content", content || "");
        formData.append("SenderIdentifier", senderIdentifier);
        formData.append("SenderName", senderName);
        formData.append("ClientIdentifier", this._clientId);
        if (conversationId) formData.append("ConversationId", conversationId);
        if (files) {
            const fileList = Array.isArray(files) ? files : [files];
            fileList.forEach(f => formData.append("files", f));
        }
        if (senderCompany) formData.append("SenderCompany", senderCompany);
        if (pageUrl) formData.append("PageUrl", pageUrl);

        return this._request(this._base + "/api/webhooks/widget", {
            method: "POST",
            body: formData
        }).then(res => {
            if (!res.ok) throw new Error(`POST failed: ${res.status}`);
            return res.json();
        });
    }

    loadHistory(conversationId) {
        return this._request(this._base + "/api/widget/conversations/" + conversationId + "/messages")
            .then(res => {
                if (!res.ok) throw new Error(`GET history failed: ${res.status}`);
                return res.json();
            });
    }
}