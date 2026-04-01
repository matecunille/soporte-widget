import { hexToRgb, escapeHtml } from "./utils.js";

export function generateStyles(config) {
    const position = config.position === "left" ? "left" : "right";
    const opposite = position === "left" ? "right" : "left";
    const primary = config.primaryColor;
    const rgb = hexToRgb(primary);
    const zIndex = config.zIndex;

    return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      all: initial;
      font-family: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 14px; line-height: 1.5; color: #1d1d1f;
      -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    }

    @keyframes sw-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes sw-scale-in {
      from { opacity: 0; transform: scale(0.92) translateY(12px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes sw-pulse-ring {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(1.8); opacity: 0; }
    }
    @keyframes sw-msg-in {
      from { opacity: 0; transform: translateY(6px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes sw-dot-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    .sw-fab {
      position: fixed; bottom: 24px; ${position}: 24px; ${opposite}: auto;
      z-index: ${zIndex};
      width: 54px; height: 54px; border-radius: 16px;
      background: ${primary}; border: none; cursor: pointer;
      box-shadow: 0 2px 8px rgba(${rgb},0.3), 0 8px 24px rgba(${rgb},0.15);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease;
      outline: none; color: #fff; overflow: visible;
    }
    .sw-fab:hover {
      transform: scale(1.06);
      box-shadow: 0 4px 12px rgba(${rgb},0.35), 0 12px 32px rgba(${rgb},0.2);
    }
    .sw-fab:active { transform: scale(0.96); }
    .sw-fab:focus-visible { outline: 2px solid ${primary}; outline-offset: 3px; }
    .sw-fab svg { width: 24px; height: 24px; transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s; }
    .sw-fab .sw-icon-chat { position: absolute; }
    .sw-fab .sw-icon-close { position: absolute; opacity: 0; transform: rotate(-90deg) scale(0.5); }
    .sw-fab.open .sw-icon-chat { opacity: 0; transform: rotate(90deg) scale(0.5); }
    .sw-fab.open .sw-icon-close { opacity: 1; transform: rotate(0) scale(1); }

    .sw-fab-ring {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      border-radius: 16px; border: 2px solid ${primary};
      pointer-events: none; opacity: 0;
    }
    .sw-fab.has-unread .sw-fab-ring {
      animation: sw-pulse-ring 2s cubic-bezier(0.4,0,0.2,1) infinite;
    }

    .sw-badge {
      position: absolute; top: -5px; ${position === "right" ? "left" : "right"}: -5px;
      background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
      min-width: 18px; height: 18px; border-radius: 9px;
      display: none; align-items: center; justify-content: center;
      padding: 0 5px; line-height: 1; letter-spacing: -0.02em;
      box-shadow: 0 2px 6px rgba(239,68,68,0.4);
    }
    .sw-badge.visible { display: flex; }

    .sw-popup {
      position: fixed; bottom: 92px; ${position}: 24px; ${opposite}: auto;
      z-index: ${zIndex - 1};
      width: 380px; height: 540px; max-height: calc(100vh - 110px);
      border-radius: 16px; overflow: hidden;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.04), 0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
      display: flex; flex-direction: column;
      background: #fafafa;
      opacity: 0; transform: scale(0.92) translateY(12px);
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1);
    }
    .sw-popup.visible {
      opacity: 1; transform: scale(1) translateY(0);
      pointer-events: auto;
    }

    .sw-header {
      background: linear-gradient(135deg, #f2f2f7 0%, #e5e5ea 100%);
      padding: 20px 20px 18px; position: relative;
      flex-shrink: 0;
    }
    .sw-header::after {
      content: ""; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(${rgb},0.15), transparent);
    }
    .sw-header-row { display: flex; align-items: center; gap: 12px; }
    .sw-header-avatar {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: ${primary}; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px; color: #fff; letter-spacing: -0.01em;
      position: relative;
    }
    .sw-header-avatar img {
      width: 100%; height: 100%; border-radius: 10px; object-fit: cover;
    }
    .sw-header-text { flex: 1; min-width: 0; }
    .sw-header-title {
      color: #1c1c1e; font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sw-header-subtitle {
      color: #8e8e93; font-size: 12px; margin-top: 1px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sw-header-dot {
      position: absolute; bottom: -1px; right: -1px;
      width: 8px; height: 8px; border-radius: 50%; background: #34d399;
      border: 2px solid #f2f2f7;
      box-shadow: none;
    }
    .sw-btn-close {
      position: absolute; top: 14px; right: 12px;
      background: none; border: none; color: rgba(0,0,0,0.4);
      cursor: pointer; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px; transition: background 0.15s, color 0.15s;
    }
    .sw-btn-close:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.7); }
    .sw-btn-close svg { width: 16px; height: 16px; }

    .sw-status {
      text-align: center; font-size: 11px; padding: 5px 12px; font-weight: 500;
      flex-shrink: 0; letter-spacing: 0.01em;
    }
    .sw-status.connecting { background: #fefce8; color: #a16207; }
    .sw-status.disconnected { background: #fef2f2; color: #b91c1c; }
    .sw-status.hidden { display: none; }

    .sw-body {
      flex: 1; overflow-y: auto; padding: 16px 16px 8px;
      display: flex; flex-direction: column;
    }
    .sw-body::-webkit-scrollbar { width: 3px; }
    .sw-body::-webkit-scrollbar-track { background: transparent; }
    .sw-body::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 3px; }
    .sw-messages { display: flex; flex-direction: column; gap: 2px; }

    .sw-msg-in-group {
      display: flex; flex-direction: column; align-items: flex-start;
      max-width: 90%; margin-top: 12px;
      animation: sw-msg-in 0.3s cubic-bezier(0.16,1,0.3,1) both;
    }
    .sw-msg-in-group .sw-msg-sender {
      font-size: 11px; color: #86868b; font-weight: 500; margin-bottom: 4px;
      padding-left: 2px; letter-spacing: 0.01em;
    }
    .sw-msg-in {
      background: #fff; padding: 10px 14px; border-radius: 4px 14px 14px 14px;
      word-wrap: break-word; max-width: 100%;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .sw-msg-in + .sw-msg-in { border-radius: 4px 14px 14px 4px; margin-top: 2px; }
    .sw-msg-in .sw-msg-text,
    .sw-msg-out .sw-msg-text {
      font-size: 13.5px;
      line-height: 1.6;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .sw-msg-in .sw-msg-text { color: #1d1d1f; }

    .sw-msg-out-group {
      display: flex; flex-direction: column; align-items: flex-end;
      max-width: 90%; align-self: flex-end; margin-top: 12px;
      animation: sw-msg-in 0.3s cubic-bezier(0.16,1,0.3,1) both;
    }
    .sw-msg-out {
      background: ${primary}; padding: 10px 14px;
      border-radius: 14px 14px 4px 14px;
      word-wrap: break-word; max-width: 100%;
    }
    .sw-msg-out + .sw-msg-out { border-radius: 14px 4px 4px 14px; margin-top: 2px; }
    .sw-msg-out .sw-msg-text { color: #fff; }

    .sw-msg-time {
      font-size: 10px; color: #aeaeb2; margin-top: 4px; padding: 0 4px;
      letter-spacing: 0.02em;
    }

    .sw-welcome {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; flex: 1; padding: 32px 24px; text-align: center;
      animation: sw-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both;
    }
    .sw-welcome-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: linear-gradient(135deg, ${primary}, ${primary}cc);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 16px;
      box-shadow: 0 4px 16px rgba(${rgb},0.25);
    }
    .sw-welcome-icon img {
      width: 100%; height: 100%; border-radius: 14px; object-fit: cover;
    }
    .sw-welcome-title {
      font-size: 16px; font-weight: 600; color: #1d1d1f;
      margin-bottom: 6px; letter-spacing: -0.01em;
    }
    .sw-welcome-text {
      font-size: 13.5px; color: #86868b; line-height: 1.5; max-width: 260px;
    }

    .sw-footer {
      border-top: 1px solid #e5e5ea; display: flex; align-items: flex-end;
      padding: 8px 8px 8px 16px; flex-shrink: 0;
      background: #fff; gap: 4px;
      transition: border-color 0.2s;
    }
    .sw-footer.focused { border-color: rgba(${rgb},0.4); }
    .sw-input {
      flex: 1; border: none; outline: none; padding: 8px 0;
      font-size: 14px; font-family: inherit; background: transparent;
      min-height: 36px; max-height: 100px; resize: none; color: #1d1d1f;
      line-height: 1.4;
    }
    .sw-input::placeholder { color: #c7c7cc; }
    .sw-send-btn {
      background: ${primary}; border: none; cursor: pointer;
      width: 34px; height: 34px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; flex-shrink: 0;
      transition: opacity 0.15s, transform 0.15s;
    }
    .sw-send-btn:disabled { opacity: 0.3; cursor: default; transform: scale(0.92); }
    .sw-send-btn:not(:disabled):hover { opacity: 0.9; }
    .sw-send-btn:not(:disabled):active { transform: scale(0.9); }
    .sw-send-btn svg { width: 16px; height: 16px; }

    .sw-powered {
      text-align: center; font-size: 10px; color: #c7c7cc; padding: 4px 0 8px;
      background: #fff; flex-shrink: 0; letter-spacing: 0.02em;
    }
    .sw-powered a { color: #aeaeb2; text-decoration: none; }
    .sw-powered a:hover { color: #86868b; }

    .sw-attach-btn {
      background: none; border: none; cursor: pointer;
      width: 34px; height: 34px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: #aeaeb2; flex-shrink: 0;
      transition: color 0.15s, background 0.15s;
    }
    .sw-attach-btn:hover { color: ${primary}; background: rgba(${rgb},0.08); }
    .sw-attach-btn svg { width: 18px; height: 18px; }

    .sw-img-preview {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; background: #f5f5f7; border-top: 1px solid #e5e5ea;
      flex-shrink: 0;
    }
    .sw-img-preview-thumb {
      width: 48px; height: 48px; border-radius: 8px; object-fit: cover;
      border: 1px solid #e5e5ea;
    }
    .sw-img-preview-name {
      flex: 1; min-width: 0; font-size: 12px; color: #636366;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sw-img-preview-remove {
      background: none; border: none; cursor: pointer;
      width: 24px; height: 24px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      color: #aeaeb2; font-size: 16px; line-height: 1;
      transition: color 0.15s, background 0.15s;
    }
    .sw-img-preview-remove:hover { color: #ef4444; background: rgba(239,68,68,0.08); }

    .sw-msg-image {
      max-width: 220px; border-radius: 10px; cursor: pointer;
      display: block; margin-bottom: 4px;
      transition: opacity 0.15s;
    }
    .sw-msg-image:hover { opacity: 0.85; }

    .sw-lightbox {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: ${zIndex + 10};
      background: rgba(0,0,0,0.85); display: flex;
      align-items: center; justify-content: center;
      cursor: zoom-out;
      animation: sw-fade-up 0.2s ease both;
    }
    .sw-lightbox img {
      max-width: 90%; max-height: 90%; border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }

    @media (max-width: 480px) {
      .sw-popup {
        width: 100vw; height: 100vh; max-height: 100vh;
        bottom: 0; left: 0; right: 0; top: 0;
        border-radius: 0; transform-origin: bottom center;
      }
      .sw-fab.open { display: none; }
    }

    .sw-error-message {
      background: #fee2e2;
      color: #b91c1c;
      padding: 8px 12px;
      border-radius: 8px;
      margin: 8px 16px;
      font-size: 12px;
      text-align: center;
      border: 1px solid #fecaca;
      animation: sw-fade-up 0.3s ease;
    }
    
    .sw-error-message button {
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      margin-left: 8px;
      cursor: pointer;
      font-size: 11px;
    }
    
    .sw-error-message button:hover {
      background: #dc2626;
    }
    
    .sw-retry-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 6px 12px;
      background: #fff3cd;
      color: #856404;
      font-size: 12px;
      border-bottom: 1px solid #ffeeba;
    }
    
    .sw-retry-bar button {
      background: #ffc107;
      color: #333;
      border: none;
      border-radius: 4px;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
    }
  `;
}

export const closeIconSvg = `<svg class="sw-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
