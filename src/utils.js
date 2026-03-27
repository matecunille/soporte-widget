export function escapeHtml(text) {
    const span = document.createElement("span");
    span.textContent = text;
    return span.innerHTML;
}

export function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

export function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch {}
}

export function storageRemove(key) {
    try { localStorage.removeItem(key); } catch {}
}

export function formatTime(isoString) {
    const date = new Date(isoString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes;
}

export function hexToRgb(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) {
        hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    const num = parseInt(hex, 16);
    return `${(num>>16)&255},${(num>>8)&255},${num&255}`;
}

// ✅ FIX 5: AudioContext singleton
let audioCtx = null;

export function playNotificationSound() {
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(660, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
        console.warn("Audio error", e);
    }
}

export const STORAGE_CONVERSATION_ID = "soporte_widget_conversationId";
export const STORAGE_CONVERSATION_TIMESTAMP = "soporte_widget_conversation_timestamp";

let authState = { token: null, expiresAt: 0, userName: null, password: null };

export function setWidgetCredentials(userName, password) {
    authState = { token: null, expiresAt: 0, userName, password };
}

export async function fetchWidgetToken(apiBase) {
    if (!authState.userName || !authState.password) {
        throw new Error("Widget credentials not set");
    }

    if (authState.token && authState.expiresAt > Date.now() + 300000) {
        return authState.token;
    }

    const res = await fetch(`${apiBase.replace(/\/+$/, "")}/api/Authentication/Authenticate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({ userName: authState.userName, password: authState.password })
    });

    if (!res.ok) {
        console.error("Auth error", res.status);
        throw new Error(`Auth failed: ${res.status}`);
    }

    const token = await res.json();
    authState.token = token;

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        authState.expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + 7200000;
    } catch {
        authState.expiresAt = Date.now() + 7200000;
    }

    return authState.token;
}