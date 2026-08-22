import EditorRuntime from './EditorRuntime.js';
import CustomCodeManager from '../includes/CustomCodeManager.js';
import ViewportManager from './ViewportManager.js';
import NavigatorManager from './NavigatorManager.js';
import FinderManager from './FinderManager.js';
import { createCopilotTools } from './CopilotTools.js';
import inkCanvasCss from '../styles/canvas.scss?asString';
import inkMagicCss from '../styles/canvas-magic.scss?asString';

const CANVAS_BASE_CSS = `
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#54595f;background:#fff}
*{box-sizing:border-box}html,body{margin:0;min-height:100%}body{min-height:100vh}.ink-canvas-root{min-height:100vh}
img,svg,video,canvas{display:block;max-width:100%}button,input,select,textarea{font:inherit}a{color:inherit}
.ink-element{position:relative;min-width:0}.ink-editor-overlay,.ink-editor-empty,.ink-editor-root-empty,.ink-editor-context-menu,.ink-editor-drop-line{display:none}
`;

const EDITOR_CANVAS_CSS = `
body.ink-builder-design .ink-editor-overlay{position:absolute;inset:0;z-index:9990;pointer-events:none;display:block}
body.ink-builder-design .ink-canvas-root:has(> .ink-element){padding-top:28px}
body.ink-builder-design .ink-element:hover>.ink-editor-overlay{box-shadow:0 0 0 1px #a4afb7}
body.ink-builder-design .ink-element[data-ink-kind="column"]:hover>.ink-editor-overlay{box-shadow:none}
body.ink-builder-design .ink-element[data-ink-kind="column"]:hover>.ink-editor-overlay::after{content:"";position:absolute;inset:1px;outline:1px dashed #6d7882}
body.ink-builder-design .ink-element.ink-is-selected>.ink-editor-overlay{box-shadow:0 0 0 2px var(--ink-editor-accent,#93003c)}
body.ink-builder-design .ink-element[data-ink-kind="column"].ink-is-selected>.ink-editor-overlay::after{display:none}
body.ink-builder-design .ink-editor-toolbar{position:absolute;top:0;right:0;display:flex;height:24px;overflow:hidden;background:#54595f;color:#fff;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.12);opacity:0;transition:opacity .12s}
body.ink-builder-design .ink-element:hover>.ink-editor-overlay>.ink-editor-toolbar,body.ink-builder-design .ink-element.ink-is-selected>.ink-editor-overlay>.ink-editor-toolbar{opacity:1;pointer-events:auto}
body.ink-builder-design .ink-element[data-ink-kind="widget"].ink-is-selected>.ink-editor-overlay>.ink-editor-toolbar{background:var(--ink-editor-accent,#93003c)}
body.ink-builder-design .ink-element[data-ink-kind="widget"]>.ink-editor-overlay>.ink-editor-toolbar{border-radius:0 0 0 3px}
body.ink-builder-design .ink-element[data-ink-kind="section"]>.ink-editor-overlay>.ink-editor-toolbar{top:auto;right:auto;bottom:0;left:0;flex-direction:row-reverse;border-radius:0 3px 0 0;background:#93003c}
body.ink-builder-design .ink-element[data-ink-kind="column"]>.ink-editor-overlay>.ink-editor-toolbar{top:auto;right:auto;bottom:0;left:0;flex-direction:row-reverse;border-radius:0 3px 0 0;background:#7a7a7a}
body.ink-builder-design .ink-element[data-ink-kind="container"]>.ink-editor-overlay{box-shadow:0 0 0 1px #e6a1ef}
body.ink-builder-design .ink-element.ink-is-selected[data-ink-kind="container"]>.ink-editor-overlay{box-shadow:0 0 0 2px #e6a1ef}
body.ink-builder-design .ink-element[data-ink-kind="container"]>.ink-editor-overlay>.ink-editor-toolbar{top:-24px;right:auto;left:50%;height:24px;transform:translateX(-50%);flex-direction:row;border-radius:0;background:#e6a1ef;color:#17191c;clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 100%,0 100%);padding-inline:8px}
body.ink-builder-design .ink-element.ink-is-selected[data-ink-kind="section"]>.ink-editor-overlay>.ink-editor-toolbar,
body.ink-builder-design .ink-element.ink-is-selected[data-ink-kind="column"]>.ink-editor-overlay>.ink-editor-toolbar,
body.ink-builder-design .ink-element.ink-is-selected[data-ink-kind="container"]>.ink-editor-overlay>.ink-editor-toolbar{background:#e6a1ef}
body.ink-builder-design .ink-editor-toolbar button{display:flex;width:28px;height:24px;align-items:center;justify-content:center;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;pointer-events:auto}
body.ink-builder-design .ink-editor-toolbar button:hover{background:rgba(0,0,0,.18)}body.ink-builder-design .ink-editor-toolbar .material-symbols-rounded{font-size:15px}

/* Empty canvas/container insertion surface — Elementor's full-width dashed area */
body.ink-builder-design .ink-editor-empty,body.ink-builder-design .ink-editor-root-empty{position:relative;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;border:2px dashed #b7bcc7;background:rgba(255,255,255,.4);color:#a4afb7}
body.ink-builder-design .ink-editor-root-empty{width:100%;max-width:1160px;min-height:180px;margin:24px auto;padding:40px 16px;border-radius:4px}
body.ink-builder-design .ink-editor-empty{width:100%;min-height:100px;margin:2px;padding:20px 12px;border-radius:4px}
body.ink-builder-design .ink-empty-actions{display:flex;gap:10px;align-items:center;justify-content:center}
body.ink-builder-design .ink-empty-action{display:flex;width:40px;height:40px;align-items:center;justify-content:center;border:0;border-radius:50%;background:#54595f;color:#fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:background .15s,transform .1s}
body.ink-builder-design .ink-empty-action:hover{background:var(--ink-editor-accent,#93003c);transform:scale(1.06)}
body.ink-builder-design .ink-empty-action .material-symbols-rounded{font-size:22px}
body.ink-builder-design .ink-empty-caption{font-size:13px;font-style:italic}

/* Structure preset gallery — a wide visual state, not an overlapping popover */
body.ink-builder-design .ink-empty-presets{display:flex;width:100%;max-width:650px;flex-direction:column;gap:14px}
body.ink-builder-design .ink-empty-presets[hidden]{display:none}
body.ink-builder-design .ink-empty-presets-header{display:flex;gap:8px;align-items:center}
body.ink-builder-design .ink-empty-back{display:flex;width:26px;height:26px;align-items:center;justify-content:center;padding:0;border:0;border-radius:50%;background:transparent;color:#a4afb7;cursor:pointer}
body.ink-builder-design .ink-empty-back:hover{background:rgba(0,0,0,.06);color:#495157}
body.ink-builder-design .ink-empty-back .material-symbols-rounded{font-size:18px}
body.ink-builder-design .ink-empty-presets-title{font-size:13px;font-weight:500;color:#495157}
body.ink-builder-design .ink-empty-preset-list{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:center}
body.ink-builder-design .ink-empty-preset{display:flex;flex-direction:column;gap:6px;align-items:center;padding:8px 6px;border:0;background:transparent;color:#495157;font:11px Roboto,Arial,sans-serif;cursor:pointer}
body.ink-builder-design .ink-empty-preset:hover{color:var(--ink-editor-accent,#93003c)}
body.ink-builder-design .ink-empty-preset-bars{display:flex;width:88px;height:40px;gap:3px;align-items:stretch}
body.ink-builder-design .ink-empty-preset-bars i{display:block;border:1px solid #a4afb7;border-radius:2px;background:#fff;transition:background .15s,border-color .15s}
body.ink-builder-design .ink-empty-preset:hover .ink-empty-preset-bars i{border-color:var(--ink-editor-accent,#93003c);background:color-mix(in srgb,var(--ink-editor-accent,#93003c) 12%,#fff)}

/* Column resize handles + percentage feedback */
body.ink-builder-design .ink-el-column-resize{position:absolute;z-index:2;top:0;bottom:0;width:9px;cursor:col-resize;pointer-events:auto}
body.ink-builder-design .ink-el-column-resize.is-e{right:-5px}
body.ink-builder-design .ink-el-column-resize.is-w{left:-5px}
body.ink-builder-design .ink-el-column-resize::after{content:"";position:absolute;top:0;bottom:0;left:50%;width:2px;background:transparent;transition:background .15s}
body.ink-builder-design .ink-element:hover>.ink-editor-overlay .ink-el-column-resize::after,body.ink-builder-design .ink-element.ink-is-selected>.ink-editor-overlay .ink-el-column-resize::after{background:rgba(255,255,255,.7)}
body.ink-builder-design .ink-el-column-percent{position:fixed;z-index:9999;padding:4px 8px;border-radius:3px;background:#26292c;color:#fff;font:11px Roboto,Arial,sans-serif;pointer-events:none;opacity:0;transition:opacity .12s;transform:translate(-50%,-100%)}

/* Drag & drop indicators */
body.ink-builder-design .ink-element[data-ink-drop-position="inside"]{box-shadow:0 0 0 2px var(--ink-editor-accent,#93003c)}
body.ink-builder-design .ink-element[data-ink-drop-position="inside"].ink-el-columns>*,body.ink-builder-design .ink-el-columns[data-ink-drop-position="inside"]{box-shadow:none}
body.ink-builder-design [data-ink-drop-position="before"]{box-shadow:inset 0 4px 0 0 var(--ink-editor-accent,#93003c)}
body.ink-builder-design [data-ink-drop-position="before"][data-ink-drop-axis="row"]{box-shadow:inset 4px 0 0 0 var(--ink-editor-accent,#93003c)}
body.ink-builder-design [data-ink-drop-position="after"]{box-shadow:inset 0 -4px 0 0 var(--ink-editor-accent,#93003c)}
body.ink-builder-design [data-ink-drop-position="after"][data-ink-drop-axis="row"]{box-shadow:inset -4px 0 0 0 var(--ink-editor-accent,#93003c)}
body.ink-builder-design .ink-editor-drop-line{position:absolute;z-index:9995;display:block;background:var(--ink-editor-accent,#93003c);pointer-events:none;border-radius:2px}
body.ink-builder-design .ink-editor-drop-line.is-before{top:0;left:0;right:0;height:4px}
body.ink-builder-design .ink-editor-drop-line.is-after{bottom:0;left:0;right:0;height:4px}

body.ink-builder-design .ink-editor-context-menu{position:fixed;z-index:10000;display:flex;width:180px;flex-direction:column;padding:5px 0;border:1px solid #d5dadf;border-radius:3px;background:#fff;box-shadow:0 2px 15px rgba(0,0,0,.2);font:13px Roboto,Arial,sans-serif;color:#495157}
body.ink-builder-design .ink-editor-context-menu button{display:flex;gap:10px;align-items:center;padding:8px 14px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
body.ink-builder-design .ink-editor-context-menu button:hover{background:#f1f3f5;color:var(--ink-editor-accent,#93003c)}body.ink-builder-design .ink-editor-context-menu button:disabled{opacity:.4;cursor:not-allowed}body.ink-builder-design .ink-editor-context-menu span.material-symbols-rounded{font-size:16px}
body.ink-builder-design .ink-editor-inline-toolbar{position:absolute;z-index:9996;display:flex;top:calc(100% + 2px);left:0;padding:2px;border-radius:3px;background:#26292c;color:#fff;pointer-events:auto;box-shadow:0 2px 10px rgba(0,0,0,.2)}
body.ink-builder-design .ink-editor-inline-toolbar button{display:flex;width:26px;height:26px;align-items:center;justify-content:center;border:0;border-radius:3px;background:transparent;color:#fff;font-size:12px;cursor:pointer}
body.ink-builder-design .ink-editor-inline-toolbar button:hover{background:rgba(255,255,255,.15)}

/* Hidden + locked element states (Phase 4 navigator toggles) */
body.ink-builder-design .ink-element[data-ink-hidden]{opacity:.4}
body.ink-builder-design .ink-element[data-ink-hidden]>.ink-editor-overlay{box-shadow:inset 0 0 0 1px dashed #6d7882}
body.ink-builder-design .ink-element[data-ink-hidden]>.ink-editor-overlay::after{content:"hidden";position:absolute;top:2px;left:2px;padding:1px 5px;border-radius:2px;background:rgba(84,89,95,.85);color:#fff;font:9px Roboto,Arial,sans-serif;text-transform:uppercase;letter-spacing:.6px}
body.ink-builder-design .ink-editor-overlay.is-locked{background-image:repeating-linear-gradient(45deg,rgba(0,0,0,.04) 0 6px,transparent 6px 12px)}
body.ink-builder-design .ink-editor-overlay.is-locked::after{content:"lock";font-family:"Material Symbols Rounded";position:absolute;right:2px;bottom:2px;font-size:15px;color:#6d7882}
body.ink-builder-design .ink-element[data-ink-locked]{cursor:not-allowed}
`;

export default class BuilderV2 {
    constructor(options = {}) {
        this.options = options;
        this.mainContainer = document.querySelector(options.mainContainer);
        this.settingsContainer = document.querySelector(options.settingsContainer);
        this.widgetsContainer = document.querySelector(options.widgetsContainer);
        this.assetUploadHandler = options.assetUploadHandler;
        this.mode = 'design';
        this.iframe = null;
        this.iframeDoc = null;
        this.runtime = null;
        this.pendingDevice = 'desktop';
        this.customCode = new CustomCodeManager(this, { css: options.customCss || '', js: options.customJs || '' });
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    async load(data = {}, _themeUrl, callback) {
        this.initIframe();
        const store = data?.version === 2 ? data : { version: 2, type: 'page', settings: { title: 'Blank' }, children: [] };
        this.runtime = new EditorRuntime(store);
        this.runtime.assetUploadHandler = this.assetUploadHandler;
        this.runtime.mount(this.canvasRoot, { panel: this.widgetsContainer, settingsPanel: this.settingsContainer });
        const documentTitle = document.querySelector('.ink-appbar-document-name');
        if (documentTitle) documentTitle.textContent = this.runtime.document.data.settings.title || 'Untitled';
        this.bindEditorState();
        this.initEditorChrome();
        this.initHotkeys();
        this.navigator = new NavigatorManager(this.runtime).mount();
        this.navigator.onVisibilityChange = (open) => {
            const button = document.querySelector('#structureButton');
            if (button) button.classList.toggle('is-active', open);
        };
        this.finder = new FinderManager(this.runtime).mount();
        this.copilotTools = createCopilotTools(this.runtime, this);
        this.customCode.injectEffectStyles(document);
        this.customCode.inject();
        this.save = typeof window.saveToInkwell === 'function' ? window.saveToInkwell.bind(window) : null;
        this.setMode('design');
        this.setDevice(this.pendingDevice);
        document.addEventListener('keydown', this.onKeyDown);
        callback?.();
    }

    initIframe() {
        this.mainContainer.replaceChildren();
        this.iframe = document.createElement('iframe');
        this.iframe.title = 'Ink Builder canvas';
        this.iframe.style.cssText = 'width:100%;height:100%;border:0;background:#fff;transition:width .2s ease;';
        this.mainContainer.appendChild(this.iframe);
        this.iframeDoc = this.iframe.contentDocument;
        this.iframeDoc.open();
        this.iframeDoc.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Material+Symbols+Rounded"><style id="ink-canvas-base">${CANVAS_BASE_CSS}</style><style id="ink-canvas-styles">${inkCanvasCss}</style><style id="ink-magic-canvas-styles">${inkMagicCss}</style><style id="ink-editor-canvas-styles">${EDITOR_CANVAS_CSS}</style></head><body><main class="ink-canvas-root" data-ink-canvas-root></main></body></html>`);
        this.iframeDoc.close();
        this.viewport = new ViewportManager(this).mount(this.mainContainer);
        this.canvasRoot = this.iframeDoc.querySelector('[data-ink-canvas-root]');
        this.canvasRoot.addEventListener('click', (event) => { if (event.target === this.canvasRoot) this.runtime?.selection.clear(); });
    }

    bindEditorState() {
        this.runtime.events.on('selection:change', ({ id, ids = id ? [id] : [] }) => {
            this.canvasRoot.querySelectorAll('.ink-is-selected').forEach((element) => element.classList.remove('ink-is-selected'));
            ids.forEach((selectedId) => this.canvasRoot.querySelector(`[data-ink-element-id="${CSS.escape(selectedId)}"]`)?.classList.add('ink-is-selected'));
            if (id && window.sidebarTabManager) window.sidebarTabManager.openTab(document.querySelector('[data-tab="controls"]'));
        });
        this.runtime.events.on('responsive:change', ({ device }) => this.applyDeviceWidth(device));
        this.runtime.events.on('document:settings', ({ settings }) => { const title = document.querySelector('.ink-appbar-document-name'); if (title) title.textContent = settings?.title || 'Untitled'; });
        this.runtime.events.on('library:open', ({ parentId } = {}) => this.openPanelScreen('elements', { preserveSelection: Boolean(parentId) }));
        this.runtime.events.on('history:change', ({ canUndo, canRedo }) => {
            const undo = document.querySelector('.ink-appbar button[title="Undo"]'); if (undo) undo.disabled = !canUndo;
            const redo = document.querySelector('.ink-appbar button[title="Redo"]'); if (redo) redo.disabled = !canRedo;
        });
        this.runtime.events.on('canvas:render', () => {
            this.runtime.selection.selectedIds.forEach((id) => this.canvasRoot.querySelector(`[data-ink-element-id="${CSS.escape(id)}"]`)?.classList.add('ink-is-selected'));
        });
    }

    // Top-bar entry points: route the main left panel and bring it to the front.
    openPanelScreen(screen, { preserveSelection = false } = {}) {
        const panel = this.runtime?.panel;
        if (panel && ['elements', 'site', 'history'].includes(screen)) { panel.route = screen; panel.render(); }
        if (window.sidebarTabManager) window.sidebarTabManager.openTab(document.querySelector('[data-tab="widgets"]'));
        if (!preserveSelection) this.runtime.selection.clear();
        return panel;
    }

    initEditorChrome() {
        const sidebar = document.querySelector('.builder-sidebar');
        if (!sidebar || sidebar.querySelector('.ink-v2-panel-resizer')) return;
        const resizer = document.createElement('div'); resizer.className = 'ink-v2-panel-resizer';
        const collapse = document.createElement('button'); collapse.type = 'button'; collapse.className = 'ink-v2-panel-collapse'; collapse.title = 'Hide panel'; collapse.textContent = '‹';
        collapse.addEventListener('click', () => { const collapsed = document.body.classList.toggle('ink-panel-collapsed'); collapse.textContent = collapsed ? '›' : '‹'; collapse.title = collapsed ? 'Show panel' : 'Hide panel'; });
        resizer.addEventListener('pointerdown', (event) => {
            event.preventDefault(); const start = event.clientX, width = sidebar.getBoundingClientRect().width;
            const move = (pointer) => document.documentElement.style.setProperty('--ink-editor-panel-width', `${Math.max(240, Math.min(500, width + pointer.clientX - start))}px`);
            const stop = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop); };
            document.addEventListener('pointermove', move); document.addEventListener('pointerup', stop);
        });
        sidebar.append(resizer, collapse);
    }

    onKeyDown(event) {
        if (event.key === 'Escape' && this.hotkeys && !this.hotkeys.hidden) { event.preventDefault(); this.hotkeys.hidden = true; return; }
        if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); this.toggleHotkeys(); return; }
        const commandKey = event.ctrlKey || event.metaKey;
        if (commandKey && event.key.toLowerCase() === 'k') { event.preventDefault(); this.finder.toggle(); return; }
        const tag = event.target?.tagName?.toLowerCase();
        if (['input', 'textarea', 'select'].includes(tag)) return;
        if (commandKey && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            event.shiftKey ? this.runtime.history.redo() : this.runtime.history.undo();
        } else if (commandKey && event.key.toLowerCase() === 'y') {
            event.preventDefault(); this.runtime.history.redo();
        } else if (commandKey && event.key.toLowerCase() === 'd' && this.runtime.selection.selectedId) {
            event.preventDefault(); this.runtime.duplicate(this.runtime.selection.selectedId);
        } else if (commandKey && event.key.toLowerCase() === 'c' && this.runtime.selection.selectedId) {
            event.preventDefault(); this.runtime.copy(this.runtime.selection.selectedId);
        } else if (commandKey && event.key.toLowerCase() === 'v') {
            event.preventDefault(); this.runtime.paste(this.runtime.selection.selectedId);
        } else if (commandKey && event.key.toLowerCase() === 's') {
            event.preventDefault(); this.save?.();
        } else if (event.key === 'Escape') {
            this.runtime.selection.clear();
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && this.runtime.selection.selectedId) {
            event.preventDefault(); this.runtime.removeMany(this.runtime.selection.selectedIds);
        }
    }

    initHotkeys() {
        this.hotkeys = document.createElement('div'); this.hotkeys.className = 'ink-hotkeys'; this.hotkeys.hidden = true;
        const shortcuts = [
            ['⌘/Ctrl + K', 'Open the finder'],
            ['?', 'Show keyboard shortcuts'],
            ['⌘/Ctrl + Z', 'Undo'],
            ['⌘/Ctrl + Shift + Z / Ctrl + Y', 'Redo'],
            ['⌘/Ctrl + D', 'Duplicate selection'],
            ['⌘/Ctrl + C', 'Copy element'],
            ['⌘/Ctrl + V', 'Paste element'],
            ['⌘/Ctrl + S', 'Publish / save'],
            ['Delete / Backspace', 'Delete selection'],
            ['Shift / ⌘ + click', 'Multi-select'],
            ['Double-click text', 'Inline edit'],
            ['Escape', 'Deselect / close'],
        ];
        this.hotkeys.innerHTML = `<div class="ink-hotkeys-surface" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><header><strong>Keyboard shortcuts</strong><button type="button" data-close aria-label="Close">×</button></header><dl>${shortcuts.map(([keys, action]) => `<div><dt><kbd>${keys}</kbd></dt><dd>${action}</dd></div>`).join('')}</dl><p>History is available from the toolbar and <kbd>⌘/Ctrl + Z</kbd>.</p></div>`;
        this.hotkeys.addEventListener('pointerdown', (event) => { if (event.target === this.hotkeys) this.hotkeys.hidden = true; });
        this.hotkeys.querySelector('[data-close]').addEventListener('click', () => { this.hotkeys.hidden = true; });
        document.body.appendChild(this.hotkeys);
    }

    toggleHotkeys() { this.hotkeys.hidden = !this.hotkeys.hidden; }

    remove(id) {
        this.runtime.remove(id);
    }

    clear() {
        const before = this.runtime.serialize();
        const empty = { version: 2, type: 'page', settings: structuredClone(before.settings), children: [] };
        this.runtime.history.execute({ label: 'Clear page', do: () => this.runtime.document.replace(empty), undo: () => this.runtime.document.replace(before) });
        this.runtime.selection.clear();
    }

    // Load a store in place (used by the Copilot apply path and checkpoint restore). document.replace
    // normalizes the store (migrates legacy style buckets) and re-renders the canvas via events.
    parse(store) {
        const data = store && store.version === 2 ? store : { version: 2, type: 'page', settings: { title: 'Blank' }, children: [] };
        this.runtime.document.replace(data);
        this.runtime.selection.clear();
        this.applyCustomCode();
        return this;
    }

    render() {
        this.runtime.canvas.render();
        return this;
    }

    setDevice(device) {
        this.pendingDevice = device;
        if (this.runtime) this.runtime.responsive.setDevice(device);
        if (this.iframe) this.applyDeviceWidth(device);
    }
    applyDeviceWidth(device) { this.iframe.style.width = '100%'; this.viewport?.setDevice(device); }

    setMode(mode) { this.mode = mode === 'design' ? 'design' : 'preview'; this.iframeDoc.body.classList.toggle('ink-builder-design', this.mode === 'design'); }
    getMode() { return this.mode; }
    applyMode() { this.setMode(this.mode); }
    applyCustomCode() { this.customCode.inject(); }

    getData() { return this.runtime.serialize(); }

    getHtml() {
        this.runtime.styles.mount(this.iframeDoc, this.runtime.document);
        this.customCode.inject();
        const clone = this.iframeDoc.documentElement.cloneNode(true);
        clone.querySelector('#ink-editor-canvas-styles')?.remove();
        clone.querySelectorAll('[data-ink-editor-only]').forEach((element) => element.remove());
        clone.querySelectorAll('[data-ink-hidden]').forEach((element) => element.remove());
        clone.querySelectorAll('[data-ink-element-id],[data-ink-element-type],[data-ink-children],[data-ink-drop-position]').forEach((element) => {
            element.removeAttribute('data-ink-element-id'); element.removeAttribute('data-ink-element-type'); element.removeAttribute('data-ink-children'); element.removeAttribute('data-ink-drop-position');
            element.removeAttribute('data-ink-layout'); element.removeAttribute('data-ink-structure'); element.removeAttribute('draggable'); element.removeAttribute('contenteditable'); element.removeAttribute('data-ink-inline-editing'); element.classList.remove('ink-is-selected');
        });
        // The saved HTML is a full document, but the public page renders only the <body>
        // (see PageBuilder::BuilderBlockComponent). Hoist the builder's canvas CSS — base
        // resets, the widget vocabulary, and the per-element scoped rules — into the body so a
        // published page stays fully styled after the head is dropped.
        const body = clone.querySelector('body');
        const root = clone.querySelector('[data-ink-canvas-root]');
        if (body && root) {
            const holder = this.iframeDoc.createElement('div');
            holder.dataset.inkPublishStyles = '';
            ['#ink-canvas-base', '#ink-canvas-styles', '#ink-magic-canvas-styles', '#ink-builder-v2-styles']
                .map((selector) => clone.querySelector(selector))
                .filter(Boolean)
                .forEach((style) => holder.appendChild(style));
            root.prepend(holder);
        }
        clone.querySelector('[data-ink-canvas-root]')?.removeAttribute('data-ink-canvas-root');
        clone.querySelector('body')?.classList.remove('ink-builder-design');
        return '<!doctype html>' + clone.outerHTML;
    }

    destroy() { document.removeEventListener('keydown', this.onKeyDown); this.finder?.destroy(); this.navigator?.destroy(); this.runtime?.contextMenu?.destroy(); this.runtime?.canvas.destroy(); this.runtime?.panel?.destroy(); this.runtime?.settingsPanel?.destroy(); this.mainContainer.replaceChildren(); }
}
