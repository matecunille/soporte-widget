/**
 * utils.ts
 *
 * Shared utility functions.
 */

import type { AuthState } from './types.js';

let audioCtx: AudioContext | null = null;

export function escapeHtml(text: string): string {
    const span = document.createElement('span');
    span.textContent = text;
    return span.innerHTML;
}

/**
 * Converts a UTC ISO string to local Date object.
 * Ensures proper timezone conversion for display.
 */
export function utcToLocal(utcIsoString: string): Date {
    // If string doesn't have timezone info, assume it's UTC and append 'Z'
    const normalizedUtc = utcIsoString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(utcIsoString)
        ? utcIsoString
        : utcIsoString + 'Z';
    return new Date(normalizedUtc);
}

/**
 * Formats a time string (assumes UTC input from backend) to local time display.
 */
export function formatTime(isoString: string): string {
    const date = utcToLocal(isoString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Formats full date and time in local timezone.
 */
export function formatDateTime(isoString: string): string {
    const date = utcToLocal(isoString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Compares two UTC ISO strings for sorting.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 * Handles UTC strings correctly regardless of timezone.
 */
export function compareUtcDates(a: string, b: string): number {
    const dateA = utcToLocal(a).getTime();
    const dateB = utcToLocal(b).getTime();
    return dateA - dateB;
}

export function hexToRgb(hex: string): string {
    const cleanHex = hex.replace('#', '');
    const expanded = cleanHex.length === 3
        ? `${cleanHex[0]}${cleanHex[0]}${cleanHex[1]}${cleanHex[1]}${cleanHex[2]}${cleanHex[2]}`
        : cleanHex;
    const num = parseInt(expanded, 16);
    return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

export function playNotificationSound(): void {
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioCtx = new AudioContextClass();
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
        console.warn('Audio error', e);
    }
}

let authState: AuthState = { 
    token: null, 
    expiresAt: 0, 
    userName: null, 
    password: null 
};

export function setWidgetCredentials(userName: string, password: string): void {
    authState = { token: null, expiresAt: 0, userName, password };
}

interface JwtPayload {
    exp?: number;
}

export async function fetchWidgetToken(apiBase: string): Promise<string> {
    if (!authState.userName || !authState.password) {
        throw new Error('Widget credentials not set');
    }

    // Token valid for at least 5 more minutes
    if (authState.token && authState.expiresAt > Date.now() + 300000) {
        return authState.token;
    }

    const res = await fetch(`${apiBase.replace(/\/+$/, '')}/api/Authentication/Authenticate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ userName: authState.userName, password: authState.password })
    });

    if (!res.ok) {
        console.error('Auth error', res.status);
        throw new Error(`Auth failed: ${res.status}`);
    }

    const token = await res.json() as string;
    authState.token = token;

    try {
        const payload = JSON.parse(atob(token.split('.')[1])) as JwtPayload;
        authState.expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + 7200000;
    } catch {
        authState.expiresAt = Date.now() + 7200000;
    }

    return token;
}
