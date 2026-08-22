import EditorRuntime from './EditorRuntime.js';
import CustomCodeManager from '../includes/CustomCodeManager.js';
import ViewportManager from './ViewportManager.js';
import NavigatorManager from './NavigatorManager.js';
import FinderManager from './FinderManager.js';
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
body.ink-builder-design .ink-element[data-ink-kind="container"]>.ink-editor-overlay>.ink-editor-toolbar{top:0;right:auto;left:0;flex-direction:row;border-radius:0 0 3px 0;background:#a4afb7}
body.ink-builder-design .ink-element.ink-is-selected[data-ink-kind="section"]>.ink-editor-overlay>.ink-editor-toolbar,
body.ink-builder-design .ink-element.ink-is-selected[data-ink-kind="column"]>.ink-editor-overlay>.ink-editor-toolbar,
body.ink-builder-design .ink-element.ink-is-selected[data-ink-kind="container"]>.ink-editor-overlay>.ink-editor-toolbar{background:var(--ink-editor-accent,#93003c)}
body.ink-builder-design .ink-editor-toolbar button{display:flex;width:28px;align-items:center;justify-content:center;padding:0;border:0;background:transparent;color:inherit;font:13px/1 Arial,sans-serif;cursor:pointer;pointer-events:auto}
body.ink-builder-design .ink-editor-toolbar button:hover{background:rgba(0,0,0,.18)}body.ink-builder-design .ink-editor-toolbar span{font-size:15px}
body.ink-builder-design .ink-editor-empty,body.ink-builder-design .ink-editor-root-empty{display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;border:1px dashed #b7bcc7;background:rgba(255,255,255,.35);color:#a4afb7}
body.ink-builder-design .ink-editor-empty{min-height:72px;margin:4px;border-radius:4px}
body.ink-builder-design .ink-editor-root-empty{min-height:140px;max-width:560px;margin:24px auto;border-radius:6px}
body.ink-builder-design .ink-empty-actions{display:flex;gap:8px}
body.ink-builder-design .ink-empty-action{display:flex;width:34px;height:34px;align-items:center;justify-content:center;border:0;border-radius:50%;background:#54595f;color:#fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:background .15s,transform .1s}
body.ink-builder-design .ink-empty-action:hover{background:var(--ink-editor-accent,#93003c);transform:scale(1.06)}
body.ink-builder-design .ink-empty-action .material-symbols-rounded{font-size:20px}
body.ink-builder-design .ink-empty-caption{font-size:12px;font-style:italic}
body.ink-builder-design .ink-structure-popover{position:absolute;z-index:9997;top:calc(100% + 8px);left:50%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:10px;border:1px solid #d5dadf;border-radius:6px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.25)}
body.ink-builder-design .ink-structure-popover[hidden]{display:none}
body.ink-builder-design .ink-structure-popover button{display:flex;gap:8px;align-items:center;padding:6px 10px;border:1px solid #d5dadf;border-radius:4px;background:#fff;color:#495157;font:12px Roboto,Arial,sans-serif;cursor:pointer;white-space:nowrap}
body.ink-builder-design .ink-structure-popover button:hover{border-color:var(--ink-editor-accent,#93003c);color:var(--ink-editor-accent,#93003c)}
body.ink-builder-design .ink-structure-preset-bars{display:flex;width:44px;height:16px;gap:2px}
body.ink-builder-design .ink-structure-preset-bars i{display:block;border:1px solid #a4afb7;border-radius:1px;background:#f1f3f5}
body.ink-builder-design .ink-editor-root-empty{position:relative}
body.ink-builder-design .ink-editor-empty{position:relative}

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
        this.runtime.events.on('library:open', () => this.openPanelScreen('elements'));
        this.runtime.events.on('history:change', ({ canUndo, canRedo }) => {
            const undo = document.querySelector('.ink-appbar button[title="Undo"]'); if (undo) undo.disabled = !canUndo;
            const redo = document.querySelector('.ink-appbar button[title="Redo"]'); if (redo) redo.disabled = !canRedo;
        });
        this.runtime.events.on('canvas:render', () => {
            this.runtime.selection.selectedIds.forEach((id) => this.canvasRoot.querySelector(`[data-ink-element-id="${CSS.escape(id)}"]`)?.classList.add('ink-is-selected'));
        });
    }

    // Top-bar entry points: route the main left panel and bring it to the front.
    openPanelScreen(screen) {
        const panel = this.runtime?.panel;
        if (panel && ['elements', 'site', 'history'].includes(screen)) { panel.route = screen; panel.render(); }
        if (window.sidebarTabManager) window.sidebarTabManager.openTab(document.querySelector('[data-tab="widgets"]'));
        this.runtime.selection.clear();
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
