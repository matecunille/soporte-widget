/**
 * api-client.ts
 *
 * REST transport for the widget API.
 */

import { fetchWidgetToken } from './utils.js';
import type { WidgetConfig, ApiSendResponse } from './types.js';

interface RequestOptions extends RequestInit {
    headers?: Record<string, string>;
}

export class ApiClient {
    private readonly base: string;
    private readonly clientId: string;

    constructor(config: WidgetConfig) {
        this.base = config.apiUrl.replace(/\/+$/, '');
        this.clientId = config.clientId;
    }

    /** @internal Used for URL resolution */
    get _base(): string {
        return this.base;
    }

    private async request(url: string, options: RequestOptions = {}): Promise<Response> {
        const token = await fetchWidgetToken(this.base);
        const headers: Record<string, string> = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'X-Widget-ClientId': this.clientId
        };
        return fetch(url, { ...options, headers });
    }

    sendMessage(
        content: string,
        senderIdentifier: string,
        productName: string | undefined,
        conversationId: string | null,
        files: File[] | undefined,
        senderCompany: string,
        pageUrl: string
    ): Promise<ApiSendResponse> {
        const formData = new FormData();
        formData.append('Content', content ?? '');
        formData.append('SenderIdentifier', senderIdentifier);
        formData.append('ProductName', productName ?? '');
        formData.append('ConversationId', conversationId ?? '');
        formData.append('SenderCompany', senderCompany);
        formData.append('PageUrl', pageUrl);

        if (files?.length) {
            files.forEach(f => formData.append('files', f));
        }

        return this.request(`${this.base}/api/webhooks/widget`, {
            method: 'POST',
            body: formData
        }).then(res => {
            if (!res.ok) throw new Error(`POST failed: ${res.status}`);
            return res.json() as Promise<ApiSendResponse>;
        });
    }

    loadHistory(senderIdentifier: string): Promise<unknown> {
        const historyUrl = new URL(`${this.base}/api/widget/conversations/history`);
        if (senderIdentifier) {
            historyUrl.searchParams.set('senderIdentifier', senderIdentifier);
        }

        return this.request(historyUrl.toString())
            .then(res => {
                if (!res.ok) throw new Error(`GET history failed: ${res.status}`);
                return res.json();
            });
    }
}
