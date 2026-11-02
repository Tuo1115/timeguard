// ==UserScript==
// @name 时光机
// @namespace https://chat.mufy.ai
// @version v1.0
// @author 电子翼 | 49652595720
// @match https://chat.mufy.ai/*
// @grant none
// @run-at document-idle
// @license CC BY-NC-ND 4.0
// ==/UserScript==

(function() {
    'use strict';

    // 等待 body 出现后执行
    const init = () => {
        if (!document.body) {
            setTimeout(init, 100);
            return;
        }

        if (window.__mufySaver?.cleanup) window.__mufySaver.cleanup();

        const SKEY = 'mufy_saver_v22';
        const THEME_KEY = 'mufy_saver_theme';
        let db = { folders: [], items: [], cssStore: {} };

        try {
            const raw = JSON.parse(localStorage.getItem(SKEY) || 'null');
            if (raw && typeof raw === 'object') {
                db = raw;
                if (!db.cssStore) db.cssStore = {};
                if (!db.folders) db.folders = [];
                if (!db.items) db.items = [];
            }
        } catch (e) {}

        let themeConfig = {
            theme: 'retro',
            accent: '#3b82f6',
            font: 'mono',
            texture: 'solid'
        };
        try {
            const savedTheme = JSON.parse(localStorage.getItem(THEME_KEY) || 'null');
            if (savedTheme) themeConfig = { ...themeConfig, ...savedTheme };
        } catch (e) {}

        const saveTheme = () => localStorage.setItem(THEME_KEY, JSON.stringify(themeConfig));
        const saveDB = () => {
            try { localStorage.setItem(SKEY, JSON.stringify(db)); } catch (e) {}
        };

        const simpleHash = (str) => {
            let h = 5381;
            for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
            return 'c' + (h >>> 0).toString(36);
        };
        const putCss = (css) => {
            if (!css) return null;
            const h = simpleHash(css);
            if (!db.cssStore[h]) db.cssStore[h] = css;
            return h;
        };
        const getCss = (h) => (h && db.cssStore[h]) || '';
        const gcCssStore = () => {
            const used = new Set(db.items.map(x => x.cssHash).filter(Boolean));
            for (const k of Object.keys(db.cssStore)) if (!used.has(k)) delete db.cssStore[k];
        };

        const sleep = ms => new Promise(r => setTimeout(r, ms));
        let isBusy = false;
        const ui = { folderId: null, isSelectMode: false, selected: new Set(), showSettings: false };

        function getStats(text) {
            if (!text) return { chars: 0, tokens: 0 };
            const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
            return { chars: text.length, tokens: Math.round(cn * 1.5 + (text.length - cn) * 0.25) };
        }

        const I = {
            clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`,
            folder: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
            folderPlus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
            back: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
            more: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
            save: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
            settings: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
            check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
            alert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
            palette: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`
        };

        const getFont = () => {
            if (themeConfig.font === 'system') return `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            if (themeConfig.font === 'serif') return `Georgia, "Times New Roman", "Songti SC", serif`;
            if (themeConfig.font === 'round') return `"Nunito", "Varela Round", "PingFang SC", "Microsoft YaHei", sans-serif`;
            return `"Courier New", Courier, monospace`;
        };

        const UI_CSS = `
            :host {
            --font: "Courier New", Courier, monospace;
            --accent: #3b82f6;
            --c-bg: #e2e8f0;
            --c-panel: #f8fafc;
            --c-text: #1e293b;
            --c-border: #334155;
            --c-shadow: #334155;
            --radius: 6px;
            --shadow-style: 0 2px 0 var(--c-shadow);
            --border-style: 1.5px solid var(--c-border);
            --blur: none;
            --item-bg: #fff;
            }

            :host([data-theme="glass"]) {
            --c-bg: rgba(30, 41, 59, 0.6);
            --c-panel: rgba(255, 255, 255, 0.1);
            --c-text: #fff;
            --c-border: rgba(255, 255, 255, 0.2);
            --c-shadow: transparent;
            --radius: 12px;
            --border-style: 1px solid var(--c-border);
            --blur: blur(16px) saturate(180%);
            --item-bg: rgba(255, 255, 255, 0.05);
            }
            :host([data-theme="glass"]) .screw { display: none; }
            
            :host([data-theme="pixel"]) {
            --font: "Courier New", Courier, monospace !important;
            --c-bg: #000;
            --c-panel: #111;
            --c-text: #fff;
            --c-border: #fff;
            --c-shadow: #fff;
            --radius: 0px;
            --border-style: 2px solid var(--c-border);
            --item-bg: #222;
            }
            :host([data-theme="pixel"]) .screw { display: none; }
            :host([data-theme="pixel"]) button { box-shadow: 2px 2px 0 #fff !important; border: 2px solid #fff !important; }
            :host([data-theme="pixel"]) button:active { transform: translate(2px, 2px); box-shadow: none !important; }

            :host([data-theme="cyberpunk"]) {
            --c-bg: #09090b;
            --c-panel: #18181b;
            --c-text: #0ff;
            --c-border: #f0f;
            --c-shadow: #f0f;
            --radius: 2px;
            --border-style: 1px solid var(--c-border);
            --item-bg: rgba(240, 0, 255, 0.05);
            }
            :host([data-theme="cyberpunk"]) .screw { display: none; }
            :host([data-theme="cyberpunk"]) button { text-shadow: 0 0 5px var(--accent); box-shadow: 0 0 8px var(--c-border) !important; }
            :host([data-theme="cyberpunk"]) .title { color: var(--accent); text-shadow: 0 0 8px var(--accent); }

            :host([data-texture="glow"]) { --shadow-style: 0 0 12px var(--c-border); }
            :host([data-texture="soft"]) { --shadow-style: 0 4px 12px rgba(0,0,0,0.15); }
            :host([data-texture="none"]) { --shadow-style: none; }

            * { box-sizing: border-box; font-family: var(--font); -webkit-tap-highlight-color: transparent; }

            .screw {
            position: absolute; width: 6px; height: 6px; background: #94a3b8;
            border-radius: 50%; box-shadow: inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.4);
            z-index: 10; pointer-events: none;
            }
            .screw::after { content: ''; position: absolute; top: 50%; left: 50%; width: 4px; height: 1px; background: #334155; transform: translate(-50%, -50%) rotate(45deg); }
            .screw.tl { top: 4px; left: 4px; } .screw.tr { top: 4px; right: 4px; }
            .screw.bl { bottom: 4px; left: 4px; } .screw.br { bottom: 4px; right: 4px; }

            .native-btn {
            display: inline-flex; align-items: center; justify-content: center;
            height: 28px; padding: 0 10px; margin-left: 8px;
            border: var(--border-style); background: var(--c-panel); color: var(--c-text);
            border-radius: var(--radius); cursor: pointer; position: relative;
            box-shadow: var(--shadow-style); transition: transform 0.05s, box-shadow 0.05s;
            backdrop-filter: var(--blur); font-size: 12px; font-weight: bold; gap: 4px;
            }
            .native-btn:hover { filter: brightness(1.1); }
            .native-btn:active { transform: translateY(2px); box-shadow: none; }
            .native-btn.busy { opacity: 0.6; cursor: wait; }
            .native-btn .badge {
            position: absolute; top: -4px; right: -4px; min-width: 14px; height: 14px; padding: 0 3px;
            font-size: 9px; line-height: 12px; font-weight: bold; background: var(--accent); color: #fff;
            border-radius: 7px; text-align: center; border: 1.5px solid var(--c-border);
            }

            .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); opacity: 0; pointer-events: none; transition: opacity .2s ease; z-index: 2147483646; }
            .overlay.open { opacity: 1; pointer-events: auto; }

            .drawer {
            position: fixed; bottom: 0; left: 0; right: 0; width: 100%; max-width: 380px; margin: 0 auto;
            max-height: 70vh; background: var(--c-bg); border: var(--border-style); border-bottom: none;
            border-radius: var(--radius) var(--radius) 0 0; box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
            transform: translateY(100%); transition: transform .25s cubic-bezier(0.2, 0.8, 0.2, 1);
            z-index: 2147483647; display: flex; flex-direction: column; color: var(--c-text);
            backdrop-filter: var(--blur);
            }
            .drawer.open { transform: translateY(0); }

            .header {
            display: flex; align-items: center; gap: 8px; padding: 8px 12px; min-height: 44px;
            border-bottom: var(--border-style); border-radius: var(--radius) var(--radius) 0 0;
            }
            .back-btn, .header-actions button {
            width: 26px; height: 26px; border-radius: var(--radius); background: var(--c-panel); border: var(--border-style);
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            box-shadow: var(--shadow-style); transition: 0.05s; color: var(--c-text);
            }
            .back-btn:active, .header-actions button:active { transform: translateY(2px); box-shadow: none; }
            .header-actions button.active { background: var(--accent); color: #fff; border-color: var(--accent); box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), var(--shadow-style); }
            .title { flex: 1; font-size: 13px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }
            .header-actions { display: flex; gap: 6px; }

            #list { flex: 1; overflow-y: auto; padding: 10px; overscroll-behavior: contain; }
            #list::-webkit-scrollbar { width: 4px; }
            #list::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 2px; }

            .swipe-wrapper { position: relative; margin-bottom: 8px; border-radius: var(--radius); overflow: hidden; background: var(--c-border); border: var(--border-style); }
            .swipe-actions { position: absolute; inset: 0 0 0 auto; width: 180px; display: flex; }
            .swipe-actions button {
            flex: 1; border: none; background: transparent; font-size: 11px; font-weight: bold; cursor: pointer;
            display: flex; align-items: center; justify-content: center; color: #fff; font-family: inherit;
            border-left: var(--border-style);
            }
            .swipe-actions .preview { background: #64748b; }
            .swipe-actions .inject  { background: #10b981; }
            .swipe-actions .rename  { background: #f59e0b; }
            .swipe-actions .delete  { background: #ef4444; }

            .item {
            position: relative; z-index: 1; background: var(--item-bg);
            border-radius: calc(var(--radius) - 2px); padding: 8px 10px;
            display: flex; flex-direction: column; gap: 4px;
            transition: transform .2s ease; will-change: transform;
            backdrop-filter: var(--blur);
            }
            .item:active { filter: brightness(0.95); }

            .folder-item { flex-direction: row; align-items: center; justify-content: space-between; padding: 10px; cursor: pointer; }
            .folder-left { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: bold; }
            .folder-right { color: var(--c-text); padding: 2px; display: flex; align-items: center; border-radius: calc(var(--radius) - 2px); background: var(--c-panel); border: var(--border-style); box-shadow: var(--shadow-style); }
            .folder-right:active { transform: translateY(2px); box-shadow: none; }

            .item-header { display: flex; align-items: center; gap: 6px; }
            .item-checkbox { width: 12px; height: 12px; accent-color: var(--accent); cursor: pointer; }
            .item-name { flex: 1; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: bold; }
            .item-time { color: #64748b; font-weight: normal; font-size: 9px; }
            .item-preview { font-size: 11px; color: inherit; opacity: 0.8; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; pointer-events: none; }
            .item-stats { font-size: 9px; opacity: 0.5; pointer-events: none; margin-top: 2px; }

            .footer { padding: 8px 12px 16px; flex-shrink: 0; display: flex; gap: 8px; }
            .footer button {
            flex: 1; padding: 8px; border-radius: var(--radius); font-size: 12px; font-weight: bold; cursor: pointer; border: var(--border-style);
            display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: var(--shadow-style); transition: 0.05s;
            color: var(--c-text); background: var(--c-panel); font-family: inherit;
            }
            .footer button:active { transform: translateY(2px); box-shadow: none; }
            .btn-danger { background: #ef4444; color: #fff; border-color: #b91c1c; box-shadow: 0 2px 0 #b91c1c; }
            .btn-move { background: var(--accent); color: #fff; border-color: var(--accent); box-shadow: 0 2px 0 rgba(0,0,0,0.3); }

            .empty { text-align: center; padding: 30px 0; font-size: 11px; font-weight: bold; opacity: 0.5; }

            #settingsPanel {
            display: none; flex-direction: column; gap: 12px; padding: 16px;
            border-bottom: var(--border-style); background: var(--c-panel);
            }
            #settingsPanel.open { display: flex; }
            .set-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: bold; }
            .set-row label { opacity: 0.8; }
            .segmented { display: flex; gap: 4px; background: rgba(0,0,0,0.1); padding: 4px; border-radius: var(--radius); }
            .segmented button {
            border: none; background: transparent; padding: 4px 8px; font-size: 11px; font-weight: bold; color: inherit;
            border-radius: calc(var(--radius) - 2px); cursor: pointer; opacity: 0.6;
            }
            .segmented button.active { background: var(--c-bg); opacity: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            
            .color-dot {
            width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--c-panel); cursor: pointer; padding: 0; box-shadow: 0 0 0 1.5px var(--c-border);
            transition: transform 0.1s;
            }
            .color-dot:active { transform: scale(0.85); }
            
            input[type="color"] { -webkit-appearance: none; border: var(--border-style); width: 22px; height: 22px; padding: 0; border-radius: 50%; overflow: hidden; cursor: pointer; }
            input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
            input[type="color"]::-webkit-color-swatch { border: none; }

            #toastContainer { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 2147483649; pointer-events: none; }
            .toast {
            background: var(--c-panel); border: var(--border-style); border-radius: var(--radius); padding: 8px 12px; font-size: 11px; font-weight: bold;
            color: var(--c-text); display: flex; align-items: center; gap: 6px; box-shadow: var(--shadow-style);
            backdrop-filter: var(--blur); animation: toastIn .15s cubic-bezier(.2,.8,.2,1) forwards;
            }
            .toast.hide { animation: toastOut .15s ease forwards; }
            @keyframes toastIn  { from { opacity: 0; transform: translateY(-10px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes toastOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-10px) scale(.95); } }
        `;

        const btnRoot = document.createElement('div');
        btnRoot.id = 'mufy-saver-btn';
        btnRoot.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;';
        const btnSh = btnRoot.attachShadow({ mode: 'open' });
        
        const panelRoot = document.createElement('div');
        panelRoot.id = 'mufy-saver-panel';
        panelRoot.style.cssText = 'display: contents;';
        const panelSh = panelRoot.attachShadow({ mode: 'open' });

        function applyTheme() {
            const apply = (host) => {
                host.dataset.theme = themeConfig.theme;
                host.dataset.texture = themeConfig.texture;
                host.style.setProperty('--accent', themeConfig.accent);
                host.style.setProperty('--font', getFont());
            };
            apply(btnSh.host);
            apply(panelSh.host);
        }

        const buildUI = () => {
            btnSh.innerHTML = `<style>${UI_CSS}</style>
            <button class="native-btn" id="injectBtn" title="存档">
                ${I.clock}<span class="badge" id="btnBadge">0</span>
            </button>`;

            panelSh.innerHTML = `<style>${UI_CSS}</style>
            <div class="overlay" id="overlay"></div>
            <div class="drawer" id="drawer">
                <div class="screw tl"></div><div class="screw tr"></div>
                <div class="header">
                <button class="back-btn" id="backBtn" style="display:none">${I.back}</button>
                <div class="title" id="folderTitle">SYS.CONTROL</div>
                <div class="header-actions">
                    <button id="themeBtn" title="外观">${I.palette}</button>
                    <button id="newFolderBtn" title="新建目录">${I.folderPlus}</button>
                    <button id="selectModeBtn" title="多选">${I.check}</button>
                </div>
                </div>
                
                <div id="settingsPanel">
                <div class="set-row">
                    <label>主题 (Theme)</label>
                    <div class="segmented" id="set-theme">
                    <button data-val="retro" class="${themeConfig.theme==='retro'?'active':''}">机械</button>
                    <button data-val="glass" class="${themeConfig.theme==='glass'?'active':''}">玻璃</button>
                    <button data-val="pixel" class="${themeConfig.theme==='pixel'?'active':''}">像素</button>
                    <button data-val="cyberpunk" class="${themeConfig.theme==='cyberpunk'?'active':''}">赛博</button>
                    </div>
                </div>
                <div class="set-row">
                    <label>质感 (Texture)</label>
                    <div class="segmented" id="set-texture">
                    <button data-val="solid" class="${themeConfig.texture==='solid'?'active':''}">硬边</button>
                    <button data-val="glow" class="${themeConfig.texture==='glow'?'active':''}">发光</button>
                    <button data-val="soft" class="${themeConfig.texture==='soft'?'active':''}">柔和</button>
                    </div>
                </div>
                <div class="set-row">
                    <label>字体 (Font)</label>
                    <div class="segmented" id="set-font">
                    <button data-val="mono" class="${themeConfig.font==='mono'?'active':''}">等宽</button>
                    <button data-val="system" class="${themeConfig.font==='system'?'active':''}">系统</button>
                    <button data-val="serif" class="${themeConfig.font==='serif'?'active':''}">衬线</button>
                    </div>
                </div>
                <div class="set-row">
                    <label>主色调 (Accent)</label>
                    <div style="display:flex; gap:8px; align-items:center;">
                    <button class="color-dot" data-color="#3b82f6" style="background:#3b82f6"></button>
                    <button class="color-dot" data-color="#10b981" style="background:#10b981"></button>
                    <button class="color-dot" data-color="#f59e0b" style="background:#f59e0b"></button>
                    <button class="color-dot" data-color="#ec4899" style="background:#ec4899"></button>
                    <input type="color" id="set-accent" value="${themeConfig.accent}">
                    </div>
                </div>
                </div>

                <div id="list"></div>
                <div class="footer" id="footerBar">
                <button class="btn-primary" id="saveBtn">${I.save} 存入数据</button>
                </div>
                <div class="footer" id="selectBar" style="display:none">
                <button class="btn-move" id="batchMoveBtn">移动</button>
                <button class="btn-danger" id="batchDeleteBtn">删除</button>
                </div>
            </div>
            <div id="toastContainer"></div>`;
            
            applyTheme();
        };
        buildUI();

        const $ = s => panelSh.querySelector(s);
        const $b = s => btnSh.querySelector(s);
        const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

        function showToast(msg, type = 'success') {
            const c = $('#toastContainer');
            if (!c) return;
            const t = document.createElement('div');
            t.className = 'toast';
            t.innerHTML = `${type === 'success' ? I.check : I.alert}<span>${esc(msg)}</span>`;
            c.appendChild(t);
            setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 200); }, 2000);
        }

        async function waitFor(fn, timeout = 3000) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const r = fn(); if (r) return r;
                await sleep(50);
            }
            return null;
        }
        
        async function ensureCleanUI() {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
            await sleep(80);
            const overlays = document.querySelectorAll('.mufy-modal-backdrop');
            if (overlays.length) { document.body.click(); await sleep(100); }
        }

        function attachNativeButton() {
            if (!panelRoot.parentElement) document.body.appendChild(panelRoot);

            const allEls = Array.from(document.querySelectorAll('button, div[role="button"], span'));
            let targetRow = null;

            for (let i = allEls.length - 1; i >= 0; i--) {
                const el = allEls[i];
                const txt = (el.innerText || '').trim();
                if ((txt === '重说' || txt === '重试') && el.getBoundingClientRect().height > 0) {
                    let p = el.parentElement;
                    if (p && p.children.length === 1 && p.tagName !== 'BODY') p = p.parentElement;
                    if (p && p.tagName !== 'BODY' && p.className.includes('flex')) {
                        targetRow = p;
                        break;
                    }
                }
            }

            if (targetRow) {
                if (btnRoot.parentElement !== targetRow) {
                    targetRow.appendChild(btnRoot);
                    btnRoot.style.position = 'relative';
                    btnRoot.style.right = '';
                    btnRoot.style.bottom = '';
                    btnRoot.style.marginLeft = '8px';
                }
            } else {
                if (btnRoot.parentElement !== document.body) {
                    document.body.appendChild(btnRoot);
                }
                btnRoot.style.position = 'fixed';
                btnRoot.style.right = '16px';
                btnRoot.style.bottom = '90px';
                btnRoot.style.zIndex = '2147483647';
            }
        }

        let attachScheduled = false;
        function scheduleAttach() {
            if (attachScheduled) return;
            attachScheduled = true;
            requestAnimationFrame(() => { attachScheduled = false; attachNativeButton(); });
        }
        const observer = new MutationObserver(scheduleAttach);

        async function openEditModal() {
            await ensureCleanUI();
            const btns = document.querySelectorAll('#mufy_message_actions_btn');
            if (!btns.length) throw new Error('找不到消息菜单');
            btns[btns.length - 1].click();

            const editBtn = await waitFor(() => [...document.querySelectorAll('*')]
                .find(el => (el.innerText || '').trim() === '修改' && el.tagName !== 'SCRIPT' && el.offsetParent !== null), 4000);
            if (!editBtn) throw new Error('找不到"修改"按钮');
            editBtn.click();

            const ta = await waitFor(() => [...document.querySelectorAll('textarea')]
                .find(t => t.offsetHeight > 50 && t.offsetParent !== null), 4000);
            if (!ta) throw new Error('找不到输入框');
            return ta;
        }

        function closeEditModal(ta) {
            const cancel = [...document.querySelectorAll('button, div, span')]
                .find(el => (el.innerText || '').trim() === '取消' && el.offsetParent !== null);
            if (cancel) { cancel.click(); return; }
            try { ta.blur(); } catch (_) {}
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }

        async function fetchLatestDataWithRetry(maxRetries = 3) {
            for (let i = 1; i <= maxRetries; i++) {
                try {
                    if (i > 1) showToast(`重试中 (${i}/${maxRetries})…`, 'error');
                    await ensureCleanUI();
                    await sleep(300);

                    const btns = document.querySelectorAll('#mufy_message_actions_btn');
                    if (!btns.length) throw new Error('找不到消息菜单');
                    const lastBtn = btns[btns.length - 1];

                    let bgUrl = '';
                    const bgNode = document.getElementById('mufy_background_image');
                    if (bgNode) {
                        const m = bgNode.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
                        if (m) bgUrl = m[1];
                    }

                    let cssContent = '';
                    document.querySelectorAll('style').forEach(s => { cssContent += s.textContent + '\n'; });
                    document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
                        try { cssContent += `@import url("${l.href}");\n`; } catch (_) {}
                    });

                    let htmlContent = '';
                    let mdNode = lastBtn.parentElement.querySelector('.react-markdown, .markdown-body');
                    
                    if (mdNode) {
                        let target = mdNode;
                        for (let j = 0; j < 2; j++) {
                            if (target.parentElement && target.parentElement !== document.body && target.parentElement.clientHeight < 2000) {
                                target = target.parentElement;
                            } else { break; }
                        }
                        const clone = target.cloneNode(true);
                        clone.querySelectorAll('#mufy_message_actions_box, #mufy_message_actions_btn, #mufy-saver-btn, .mufy-actions').forEach(n => n.remove());
                        htmlContent = clone.outerHTML;
                    } else {
                        let parent = lastBtn.parentElement;
                        while (parent && parent !== document.body) {
                            if (parent.querySelector('.react-markdown, .markdown-body') || parent.classList.contains('mufy-char-card')) {
                                const clone = parent.cloneNode(true);
                                clone.querySelectorAll('#mufy_message_actions_box, #mufy_message_actions_btn, #mufy-saver-btn').forEach(n => n.remove());
                                htmlContent = clone.outerHTML;
                                break;
                            }
                            parent = parent.parentElement;
                        }
                    }

                    const ta = await openEditModal();
                    const val = ta.value;
                    closeEditModal(ta);

                    return { text: val, html: htmlContent, bgUrl, css: cssContent };
                } catch (e) {
                    if (i === maxRetries) throw e;
                    await sleep(500);
                }
            }
        }

        async function injectToLatestWithRetry(newText, maxRetries = 3) {
            for (let i = 1; i <= maxRetries; i++) {
                try {
                    if (i > 1) showToast(`重试注入 (${i}/${maxRetries})…`, 'error');
                    await sleep(300);

                    const ta = await openEditModal();
                    const oldText = ta.value;

                    if (oldText.trim() !== newText.trim() && oldText.trim()) {
                        if (confirm('即将用存档覆盖当前输出。\n\n要先把当前文本存一份吗？')) {
                            const name = prompt('保存当前为：', '备份 ' + new Date().toLocaleTimeString());
                            if (name !== null) {
                                let targetFolderId = ui.folderId;
                                if (!targetFolderId) {
                                    let def = db.folders.find(f => f.name === '未分类' && !f.parentId);
                                    if (!def) { def = { id: 'fd_uncategorized', parentId: null, name: '未分类' }; db.folders.push(def); }
                                    targetFolderId = def.id;
                                }
                                db.items.push({ id: 'it_' + Date.now(), folderId: targetFolderId, name: name.trim() || '备份', text: oldText, time: Date.now() });
                                saveDB(); render();
                            }
                        }
                    }

                    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                    setter.call(ta, newText);
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    await sleep(150);

                    const saveBtn = await waitFor(() => [...document.querySelectorAll('button')]
                        .find(el => (el.innerText || '').trim() === '保存' && el.offsetParent !== null), 4000);
                    if (!saveBtn) throw new Error('找不到保存按钮');
                    saveBtn.click();

                    await sleep(250);
                    return true;
                } catch (e) {
                    if (i === maxRetries) throw e;
                    await sleep(500);
                }
            }
        }

        async function handleSave() {
            if (isBusy) return;
            isBusy = true; render();
            try {
                const data = await fetchLatestDataWithRetry();
                if (!data.text.trim()) throw new Error('文本为空');

                const name = prompt('保存成功！起个名字：', '数据 ' + new Date().toLocaleString('zh-CN', { hour12: false }));
                if (name !== null) {
                    let targetFolderId = ui.folderId;
                    if (!targetFolderId) {
                        let def = db.folders.find(f => f.name === '未分类' && !f.parentId);
                        if (!def) { def = { id: 'fd_uncategorized', parentId: null, name: '未分类' }; db.folders.push(def); }
                        targetFolderId = def.id;
                    }
                    const cssHash = putCss(data.css);
                    db.items.push({
                        id: 'it_' + Date.now(), folderId: targetFolderId, name: name.trim() || '未命名',
                        text: data.text, html: data.html, cssHash, bgUrl: data.bgUrl, time: Date.now()
                    });
                    gcCssStore(); saveDB(); render(); showToast('数据已固化');
                }
            } catch (e) {
                alert('❌ 抓取失败：\n' + e.message);
            } finally { isBusy = false; render(); }
        }

        async function handleInject(id) {
            if (isBusy) return;
            const it = db.items.find(x => x.id === id); if (!it) return;
            isBusy = true; render();
            try {
                await injectToLatestWithRetry(it.text);
                toggleDrawer(false);
                showToast('数据注入完成');
            } catch (e) {
                alert('❌ 替换失败：\n' + e.message);
            } finally { isBusy = false; render(); }
        }

        let currentPreviewHost = null;
        function openPreview(id) {
            const it = db.items.find(x => x.id === id); if (!it) return;
            if (currentPreviewHost) currentPreviewHost.remove();

            currentPreviewHost = document.createElement('div');
            currentPreviewHost.id = 'mufy-preview-host';
            currentPreviewHost.style.cssText = 'position:fixed;inset:0;z-index:2147483648;';
            const pSh = currentPreviewHost.attachShadow({ mode: 'open' });

            const css = getCss(it.cssHash) || '';
            const htmlContent = it.html || `<div style="color:#ddd;font-size:13px;line-height:1.5;white-space:pre-wrap;padding:16px;">${esc(it.text)}</div>`;

            pSh.innerHTML = `
            <style>
                :host {
                --c-bg: ${themeConfig.theme === 'glass' ? 'rgba(30,41,59,0.6)' : themeConfig.theme === 'pixel' ? '#000' : themeConfig.theme === 'cyberpunk' ? '#09090b' : '#e2e8f0'};
                --c-panel: ${themeConfig.theme === 'glass' ? 'rgba(255,255,255,0.1)' : themeConfig.theme === 'pixel' ? '#111' : themeConfig.theme === 'cyberpunk' ? '#18181b' : '#f8fafc'};
                --c-text: ${themeConfig.theme === 'glass' || themeConfig.theme === 'pixel' ? '#fff' : themeConfig.theme === 'cyberpunk' ? '#0ff' : '#1e293b'};
                --c-border: ${themeConfig.theme === 'glass' ? 'rgba(255,255,255,0.2)' : themeConfig.theme === 'pixel' ? '#fff' : themeConfig.theme === 'cyberpunk' ? '#f0f' : '#334155'};
                --c-shadow: ${themeConfig.theme === 'glass' ? 'transparent' : themeConfig.theme === 'pixel' ? '#fff' : themeConfig.theme === 'cyberpunk' ? '#f0f' : '#334155'};
                --radius: ${themeConfig.theme === 'glass' ? '12px' : themeConfig.theme === 'pixel' ? '0px' : themeConfig.theme === 'cyberpunk' ? '2px' : '6px'};
                --shadow-style: ${themeConfig.texture === 'glow' ? '0 0 12px var(--c-border)' : themeConfig.texture === 'soft' ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 0 var(--c-shadow)'};
                --border-style: ${themeConfig.theme === 'glass' ? '1px solid var(--c-border)' : themeConfig.theme === 'pixel' ? '2px solid var(--c-border)' : '1.5px solid var(--c-border)'};
                --blur: ${themeConfig.theme === 'glass' ? 'blur(16px) saturate(180%)' : 'none'};
                --accent: ${themeConfig.accent};
                display: block;
                }
                * { box-sizing: border-box; font-family: ${getFont()}; }
                .layer { display: flex; flex-direction: column; height: 100vh; width: 100vw; background: var(--c-bg); color: var(--c-text); overflow: hidden; position: relative; }
                .bg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(4px) brightness(0.9); z-index: 0; pointer-events: none; transition: filter 0.1s; }
                .hdr { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: var(--c-panel); border-bottom: var(--border-style); z-index: 2; position: relative; flex-shrink: 0; backdrop-filter: var(--blur); }
                .hdr .t { font-weight: bold; font-size: 12px; text-transform: uppercase; }
                .hdr .btns { display: flex; gap: 6px; }
                .hdr button { border: var(--border-style); border-radius: var(--radius); padding: 4px 8px; font-size: 11px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.05s; box-shadow: var(--shadow-style); background: var(--c-panel); color: var(--c-text); font-family: inherit; }
                .hdr button:active { transform: translateY(2px); box-shadow: none; }
                .hdr .close { background: #ef4444; color: #fff; border-color: #b91c1c; box-shadow: 0 2px 0 #b91c1c; }
                .adjPanel { display: none; padding: 8px 12px; background: var(--c-panel); border-bottom: var(--border-style); z-index: 2; position: relative; flex-shrink: 0; }
                .adjPanel .row { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: bold; }
                .adjPanel .row + .row { margin-top: 8px; }
                .adjPanel .row span { width: 40px; }
                .adjPanel input[type=range] { flex: 1; accent-color: var(--accent); }
                
                .content-wrapper { flex: 1; position: relative; z-index: 1; overflow-y: auto; overflow-x: hidden; padding: 12px; -webkit-overflow-scrolling: touch; }
                .content-inner { 
                    width: 100%; max-width: 100%; position: relative; 
                    background: transparent;
                    border: none;
                    box-shadow: none;
                }
                
                .content-inner > div { 
                    position: relative !important; 
                    width: 100% !important; 
                    margin: 0 !important; 
                    padding: 16px !important; 
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    background: transparent !important; 
                    color: var(--c-text) !important; 
                }
                .content-inner * { max-height: none !important; }
                .content-inner > div > * { position: static !important; }
            </style>
            <div class="layer">
                <div class="bg" id="bg"></div>
                <div class="hdr">
                <span class="t">${esc(it.name)}</span>
                <div class="btns">
                    <button class="adj" id="adjBtn">${I.settings}</button>
                    <button class="close" id="closeBtn">关闭</button>
                </div>
                </div>
                <div class="adjPanel" id="adjPanel">
                <div class="row"><span>模糊度</span><input type="range" id="blur" min="0" max="20" value="0"></div>
                <div class="row"><span>亮度</span><input type="range" id="bright" min="10" max="100" value="100"></div>
                </div>
                <div class="content-wrapper" id="preview-container">
                <div class="content-inner" id="preview-content">
                    ${htmlContent}
                </div>
                </div>
            </div>`;

            if (css) {
                const styleTag = document.createElement('style');
                styleTag.textContent = css;
                pSh.appendChild(styleTag);
            }

            const q = s => pSh.querySelector(s);
            const bg = q('#bg');
            if (it.bgUrl) bg.style.backgroundImage = `url("${it.bgUrl}")`;

            const adjPanel = q('#adjPanel');
            q('#adjBtn').onclick = () => { adjPanel.style.display = adjPanel.style.display === 'block' ? 'none' : 'block'; };
            const blur = q('#blur'), bright = q('#bright');
            const updateFilter = () => { bg.style.filter = `blur(${blur.value}px) brightness(${bright.value / 100})`; };
            blur.oninput = updateFilter; bright.oninput = updateFilter;
            q('#closeBtn').onclick = () => { currentPreviewHost.remove(); currentPreviewHost = null; };

            document.body.appendChild(currentPreviewHost);
        }

        function render() {
            const btn = $b('#injectBtn'), badge = $b('#btnBadge');
            if (btn && badge) {
                if (isBusy) { btn.classList.add('busy'); badge.textContent = '…'; }
                else { btn.classList.remove('busy'); badge.textContent = String(db.items.length); }
            }

            const curFolder = db.folders.find(x => x.id === ui.folderId);
            $('#folderTitle').textContent = curFolder ? curFolder.name : 'SYS.CONTROL';
            $('#backBtn').style.display = curFolder ? 'flex' : 'none';

            const selectBtn = $('#selectModeBtn');
            selectBtn.innerHTML = ui.isSelectMode ? I.more : I.check;
            selectBtn.classList.toggle('active', ui.isSelectMode);
            $('#footerBar').style.display = ui.isSelectMode ? 'none' : 'flex';
            $('#selectBar').style.display = ui.isSelectMode ? 'flex' : 'none';

            const folders = db.folders.filter(f => f.parentId === ui.folderId);
            const items = db.items.filter(i => i.folderId === ui.folderId).sort((a, b) => b.time - a.time);
            const list = $('#list');

            if (!folders.length && !items.length) {
                list.innerHTML = `<div class="empty">${ui.folderId ? '空数据块' : '无记录'}</div>`;
                return;
            }

            let html = folders.map(f => `
            <div class="swipe-wrapper" style="overflow:visible;background:transparent;margin-bottom:8px;border:none;">
                <div class="item folder-item" data-action="enterFolder" data-id="${f.id}">
                <div class="folder-left">${I.folder} ${esc(f.name)}</div>
                <div class="folder-right" data-action="editFolder" data-id="${f.id}">${I.more}</div>
                </div>
            </div>`).join('');

            html += items.map(i => {
                const s = getStats(i.text);
                return `
                <div class="swipe-wrapper" data-id="${i.id}">
                <div class="swipe-actions">
                    <button class="preview" data-action="preview" data-id="${i.id}">预览</button>
                    <button class="inject" data-action="inject" data-id="${i.id}">注入</button>
                    <button class="rename" data-action="renameItem" data-id="${i.id}">改名</button>
                    <button class="delete" data-action="deleteItem" data-id="${i.id}">删除</button>
                </div>
                <div class="item" data-id="${i.id}">
                    <div class="item-header">
                    ${ui.isSelectMode ? `<input type="checkbox" class="item-checkbox" data-action="select" data-id="${i.id}" ${ui.selected.has(i.id) ? 'checked' : ''}>` : ''}
                    <div class="item-name">
                        <span>${esc(i.name)}</span>
                        <span class="item-time">${new Date(i.time).toLocaleTimeString('zh-CN', { hour12: false })}</span>
                    </div>
                    </div>
                    <div class="item-preview">${esc(i.text)}</div>
                    <div class="item-stats">${s.chars} 字 · ${s.tokens} tk</div>
                </div>
                </div>`;
            }).join('');

            list.innerHTML = html;
            bindSwipeEvents();
        }

        let activeSwipeEl = null;
        let startX = 0, startY = 0, startTransform = 0;

        function bindSwipeEvents() {
            panelSh.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
                const item = wrapper.querySelector('.item');
                if (!item || item.classList.contains('folder-item')) return;

                item.addEventListener('touchstart', e => {
                    if (ui.isSelectMode) return;
                    if (activeSwipeEl && activeSwipeEl !== item) activeSwipeEl.style.transform = 'translateX(0)';
                    activeSwipeEl = item;
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    const matrix = new WebKitCSSMatrix(window.getComputedStyle(item).transform);
                    startTransform = matrix.m41;
                }, { passive: true });

                item.addEventListener('touchmove', e => {
                    if (!activeSwipeEl) return;
                    const dx = e.touches[0].clientX - startX;
                    const dy = e.touches[0].clientY - startY;
                    let nx = startTransform + dx;
                    if (nx > 0) nx = 0;
                    if (nx < -180) nx = -180;
                    item.style.transition = 'none';
                    item.style.transform = `translateX(${nx}px)`;
                    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) e.preventDefault();
                }, { passive: false });

                item.addEventListener('touchend', e => {
                    if (!activeSwipeEl) return;
                    const dx = e.changedTouches[0].clientX - startX;
                    const cur = startTransform + dx;
                    item.style.transition = 'transform .2s ease';
                    item.style.transform = cur < -80 ? 'translateX(-180px)' : 'translateX(0)';
                    activeSwipeEl = null;
                });
            });
        }

        function toggleDrawer(open) {
            if (open) {
                $('#drawer').classList.add('open');
                $('#overlay').classList.add('open');
                ui.folderId = null; ui.isSelectMode = false; ui.selected.clear(); ui.showSettings = false;
                $('#settingsPanel').classList.remove('open');
                render();
            } else {
                $('#drawer').classList.remove('open');
                $('#overlay').classList.remove('open');
            }
        }

        function createFolder() {
            const name = prompt('新建目录名称：');
            if (name && name.trim()) { db.folders.push({ id: 'fd_' + Date.now(), parentId: ui.folderId, name: name.trim() }); saveDB(); render(); }
        }

        function editFolder(id) {
            const f = db.folders.find(x => x.id === id); if (!f) return;
            const action = prompt(`[${f.name}]\n输入新名字重命名，或输入 "删除" 删除：`, f.name);
            if (action === null) return;
            if (action === '删除') {
                if (!confirm('⚠️ 确定连同内部所有存档一并删除吗？')) return;
                const removeDeep = (fid) => {
                    const children = db.folders.filter(x => x.parentId === fid);
                    children.forEach(x => removeDeep(x.id));
                    db.folders = db.folders.filter(x => x.id !== fid);
                    db.items = db.items.filter(x => x.folderId !== fid);
                };
                removeDeep(id); gcCssStore(); saveDB(); render();
            } else if (action.trim()) { f.name = action.trim(); saveDB(); render(); }
        }

        function batchMove() {
            const targetName = prompt('输入目标目录名称（留空移回"未分类"）：', '');
            if (targetName === null) return;
            let targetId = null;
            if (targetName.trim() === '') {
                let def = db.folders.find(f => f.name === '未分类' && !f.parentId);
                if (!def) { def = { id: 'fd_uncategorized', parentId: null, name: '未分类' }; db.folders.push(def); }
                targetId = def.id;
            } else {
                const tf = db.folders.find(f => f.name === targetName.trim());
                if (!tf) { alert('找不到该文件夹'); return; }
                targetId = tf.id;
            }
            ui.selected.forEach(id => { const it = db.items.find(x => x.id === id); if (it) it.folderId = targetId; });
            ui.selected.clear(); ui.isSelectMode = false; saveDB(); render();
        }

        function batchDelete() {
            if (!ui.selected.size) return;
            if (!confirm(`确定删除选中的 ${ui.selected.size} 个记录吗？`)) return;
            db.items = db.items.filter(x => !ui.selected.has(x.id));
            ui.selected.clear(); ui.isSelectMode = false; gcCssStore(); saveDB(); render();
        }

        const updateAccent = (color) => {
            themeConfig.accent = color;
            saveTheme();
            panelSh.host.style.setProperty('--accent', themeConfig.accent);
            btnSh.host.style.setProperty('--accent', themeConfig.accent);
            const inp = $('#set-accent');
            if (inp) inp.value = color;
        };

        btnSh.addEventListener('click', e => {
            if (e.target.closest('#injectBtn')) { if (!isBusy) toggleDrawer(true); }
        });

        panelSh.addEventListener('click', e => {
            const colorDot = e.target.closest('.color-dot');
            if (colorDot) {
                updateAccent(colorDot.dataset.color);
                return;
            }

            const setBtn = e.target.closest('.segmented button');
            if (setBtn) {
                const parent = setBtn.parentElement;
                const val = setBtn.dataset.val;
                if (parent.id === 'set-theme') themeConfig.theme = val;
                if (parent.id === 'set-texture') themeConfig.texture = val;
                if (parent.id === 'set-font') themeConfig.font = val;
                
                parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                setBtn.classList.add('active');
                
                saveTheme();
                applyTheme();
                return;
            }

            const btn = e.target.closest('button[id]');
            if (btn) {
                switch (btn.id) {
                    case 'saveBtn': handleSave(); return;
                    case 'newFolderBtn': createFolder(); return;
                    case 'themeBtn': 
                        ui.showSettings = !ui.showSettings;
                        $('#settingsPanel').classList.toggle('open', ui.showSettings); 
                        return;
                    case 'backBtn': {
                        const cur = db.folders.find(x => x.id === ui.folderId);
                        ui.folderId = cur ? cur.parentId : null;
                        ui.isSelectMode = false; ui.selected.clear(); render(); return;
                    }
                    case 'selectModeBtn': ui.isSelectMode = !ui.isSelectMode; ui.selected.clear(); render(); return;
                    case 'batchDeleteBtn': batchDelete(); return;
                    case 'batchMoveBtn': batchMove(); return;
                }
            }

            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            const id = target.dataset.id;

            if (action === 'editFolder') { e.stopPropagation(); editFolder(id); return; }

            switch (action) {
                case 'enterFolder': ui.folderId = id; ui.isSelectMode = false; ui.selected.clear(); render(); break;
                case 'preview': e.stopPropagation(); openPreview(id); break;
                case 'select': target.checked ? ui.selected.add(id) : ui.selected.delete(id); break;
                case 'inject': e.stopPropagation(); handleInject(id); break;
                case 'renameItem': {
                    const it = db.items.find(x => x.id === id);
                    const n = prompt('修改名字：', it.name);
                    if (n !== null) { it.name = n.trim() || it.name; saveDB(); render(); }
                    e.stopPropagation(); break;
                }
                case 'deleteItem':
                    if (confirm('删除这条记录？')) { db.items = db.items.filter(x => x.id !== id); gcCssStore(); saveDB(); render(); }
                    e.stopPropagation(); break;
            }
        });

        panelSh.addEventListener('input', e => {
            if (e.target.id === 'set-accent') updateAccent(e.target.value);
        });
        
        panelSh.addEventListener('change', e => {
            if (e.target.id === 'set-accent') updateAccent(e.target.value);
        });

        $('#overlay').addEventListener('click', () => toggleDrawer(false));

        window.__mufySaver = {
            cleanup: () => {
                observer.disconnect();
                btnRoot.remove(); panelRoot.remove();
                if (currentPreviewHost) currentPreviewHost.remove();
                delete window.__mufySaver;
            }
        };

        const orphans = db.items.filter(x => !x.folderId);
        if (orphans.length > 0) {
            let defFolder = db.folders.find(x => x.name === '未分类' && !x.parentId);
            if (!defFolder) { defFolder = { id: 'fd_uncategorized', parentId: null, name: '未分类' }; db.folders.push(defFolder); }
            orphans.forEach(it => it.folderId = defFolder.id); saveDB();
        }
        let changed = false;
        for (const it of db.items) { if (it.css && !it.cssHash) { it.cssHash = putCss(it.css); delete it.css; changed = true; } }
        if (changed) saveDB();

        document.body.appendChild(panelRoot);
        attachNativeButton();
        observer.observe(document.body, { childList: true, subtree: true });
        render();
    };

    init();
})();