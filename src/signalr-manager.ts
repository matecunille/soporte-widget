/**
 * signalr-manager.ts
 *
 * SignalR lifecycle management.
 */

import { fetchWidgetToken } from './utils.js';
import type { WidgetConfig, SignalRStatus, AttachmentDTO } from './types.js';

type SignalRMessageCallback = (
    content: string, 
    sentAt: string, 
    attachments: AttachmentDTO[], 
    isFromLead: boolean
) => void;

type SignalRStatusCallback = (status: SignalRStatus) => void;
type SignalRReconnectingCallback = (retryCount: number) => void;

interface HubConnection {
    serverTimeoutInMilliseconds: number;
    keepAliveIntervalInMilliseconds: number;
    on(event: string, callback: (...args: unknown[]) => void): void;
    onreconnecting(callback: (error?: Error) => void): void;
    onreconnected(callback: (connectionId?: string) => void): void;
    onclose(callback: (error?: Error) => void): void;
    start(): Promise<void>;
    invoke(method: string, ...args: unknown[]): Promise<unknown>;
    stop(): Promise<void>;
    state: string;
}

interface HubConnectionBuilder {
    withUrl(url: string, options: { accessTokenFactory: () => string }): this;
    withAutomaticReconnect(delays: number[]): this;
    build(): HubConnection;
}

export class SignalRManager {
    private readonly hubUrl: string;
    private connection: HubConnection | null = null;
    private readonly onMessage: SignalRMessageCallback;
    private readonly onStatusChange: SignalRStatusCallback;
    private readonly onReconnecting?: SignalRReconnectingCallback;
    private conversationId: string | null = null;
    private reconnectAttempt = 0;

    constructor(
        config: WidgetConfig,
        onMessage: SignalRMessageCallback,
        onStatusChange: SignalRStatusCallback,
        onReconnecting?: SignalRReconnectingCallback
    ) {
        this.hubUrl = `${config.apiUrl.replace(/\/+$/, '')}/hubs/widget`;
        this.onMessage = onMessage;
        this.onStatusChange = onStatusChange;
        this.onReconnecting = onReconnecting;
    }

    private mapAttachment(attachment: Record<string, unknown>): AttachmentDTO {
        return {
            imageUrl: (attachment.url ?? attachment.Url) as string | undefined,
            fileName: (attachment.fileName ?? attachment.FileName) as string | undefined,
            contentType: (attachment.contentType ?? attachment.ContentType) as string | undefined
        };
    }

    async start(conversationId: string | null): Promise<void> {
        this.conversationId = conversationId;
        this.reconnectAttempt = 0;

        if (!window.signalR?.HubConnectionBuilder) {
            this.onStatusChange('disconnected');
            throw new Error('SignalR not loaded');
        }

        const baseUrl = this.hubUrl.replace('/hubs/widget', '');
        const token = await fetchWidgetToken(baseUrl);

        // Exponential backoff: 1s, 2s, 4s, 8s (max 4 automatic retries)
        this.connection = new window.signalR.HubConnectionBuilder()
            .withUrl(this.hubUrl, { accessTokenFactory: () => token })
            .withAutomaticReconnect([1000, 2000, 4000, 8000])
            .build();
        
        if (!this.connection) {
            throw new Error('Failed to create SignalR connection');
        }

        this.connection.serverTimeoutInMilliseconds = 60000;
        this.connection.keepAliveIntervalInMilliseconds = 15000;

        this.connection.on('RecibirRespuesta', (...args: unknown[]) => {
            const [content, sentAt, attachments] = args as [string, string, unknown[]];
            const mapped = (attachments ?? []).map((a) => this.mapAttachment(a as Record<string, unknown>));
            this.onMessage(content, sentAt, mapped, false);
        });

        this.connection.on('RecibirMensajeWidget', (...args: unknown[]) => {
            const [content, sentAt, attachments] = args as [string, string, unknown[]];
            const mapped = (attachments ?? []).map((a) => this.mapAttachment(a as Record<string, unknown>));
            this.onMessage(content, sentAt, mapped, true);
        });

        // Track reconnection attempts
        this.connection.onreconnecting(() => {
            this.reconnectAttempt++;
            this.onReconnecting?.(this.reconnectAttempt);
            this.onStatusChange('disconnected');
        });

        this.connection.onreconnected(() => {
            this.reconnectAttempt = 0;
            this.onStatusChange('connected');
            if (this.conversationId) {
                void this.joinConversation(this.conversationId);
            }
        });

        this.connection.onclose((error) => {
            this.onStatusChange('disconnected');
            if (error) {
                console.error('[SignalR] Connection closed with error:', error);
            }
        });

        this.onStatusChange('connecting');

        await this.connection.start();
        this.reconnectAttempt = 0;
        this.onStatusChange('connected');
        if (this.conversationId) {
            await this.joinConversation(this.conversationId);
        }
    }

    /**
     * Get current reconnect attempt count
     */
    getReconnectAttempt(): number {
        return this.reconnectAttempt;
    }

    joinConversation(conversationId: string): Promise<unknown> {
        this.conversationId = conversationId;
        if (this.connection?.state === 'Connected') {
            return this.connection.invoke('JoinConversation', conversationId);
        }
        return Promise.resolve();
    }

    stop(): Promise<void> {
        return this.connection?.stop() ?? Promise.resolve();
    }
}

declare global {
    interface Window {
        signalR?: {
            HubConnectionBuilder: new () => HubConnectionBuilder;
        };
    }
}
