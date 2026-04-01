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

    sendMessage(content, senderIdentifier, productName,conversationId, files, senderCompany, pageUrl) {
        const formData = new FormData();
        formData.append("Content", content || "");
        formData.append("SenderIdentifier", senderIdentifier);
        formData.append("ProductName", productName);
        formData.append("ConversationId", conversationId);
        formData.append("SenderCompany", senderCompany);
        formData.append("PageUrl", pageUrl);

        if (files) {
            const fileList = Array.isArray(files) ? files : [files];
            fileList.forEach(f => formData.append("files", f));
        }

        return this._request(this._base + "/api/webhooks/widget", {
            method: "POST",
            body: formData
        }).then(res => {
            if (!res.ok) throw new Error(`POST failed: ${res.status}`);
            return res.json();
        });
    }

    loadHistory(senderIdentifier) {
        const historyUrl = new URL(this._base + "/api/widget/conversations/history");
        if (senderIdentifier) {
            historyUrl.searchParams.set("senderIdentifier", senderIdentifier);
        }

        return this._request(historyUrl.toString())
            .then(res => {
                if (!res.ok) throw new Error(`GET history failed: ${res.status}`);
                return res.json();
            });
    }
}
