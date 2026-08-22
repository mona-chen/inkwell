// Direct editing bridge for fidelity-first site imports. The captured page remains the rendering
// source, while author edits are stored as path-addressed patches on the builder node. This keeps
// the original CSS/DOM geometry intact and makes real headings, buttons, links, images, sections,
// and containers selectable without injecting builder wrappers into the captured document.

export default class ImportedSiteEditor {
    constructor(runtime, builder, settingsContainer) {
        this.runtime = runtime;
        this.builder = builder;
        this.settingsContainer = settingsContainer;
        this.active = null;
        this.onMessage = this.onMessage.bind(this);
        builder.iframeDoc.defaultView.addEventListener('message', this.onMessage);
    }

    onMessage(event) {
        const message = event.data;
        if (!message || message.type !== 'ink-site-select') return;
        const node = this.runtime.document.get(message.snapshotId);
        if (!node || node.type !== 'site-snapshot') return;
        this.active = { node, path: message.path, descriptor: message.descriptor, source: event.source };
        this.runtime.selection.select(node.id);
        requestAnimationFrame(() => this.renderPanel());
    }

    renderPanel() {
        if (!this.active || !this.settingsContainer) return;
        const { descriptor } = this.active;
        window.sidebarTabManager?.openTab?.(document.querySelector('[data-tab="controls"]'));
        this.settingsContainer.replaceChildren();

        const header = document.createElement('header');
        header.className = 'ink-imported-dom-header';
        header.innerHTML = `<button type="button" data-import-back aria-label="Back"><span class="material-symbols-rounded">arrow_back</span></button><span><small>Imported DOM</small><strong>${this.escape(descriptor.label || descriptor.tag)}</strong></span><em>${this.escape(descriptor.tag)}</em>`;
        this.settingsContainer.appendChild(header);

        const tabs = document.createElement('div'); tabs.className = 'ink-imported-dom-tabs';
        tabs.innerHTML = '<span class="is-active">Content</span><span>Style</span><span>Advanced</span>';
        this.settingsContainer.appendChild(tabs);

        const body = document.createElement('div'); body.className = 'ink-imported-dom-controls';
        const note = document.createElement('p'); note.className = 'ink-imported-dom-note'; note.textContent = 'Editing the captured element directly. Original classes and responsive CSS remain in control.'; body.appendChild(note);
        if (descriptor.editableText) body.appendChild(this.field('Text', 'text', descriptor.text || '', true));
        if (descriptor.href != null) body.appendChild(this.field('Link', 'href', descriptor.href || ''));
        if (descriptor.src != null) body.appendChild(this.field('Image source', 'src', descriptor.src || ''));
        body.appendChild(this.field('CSS classes', 'className', descriptor.className || ''));
        body.appendChild(this.field('Inline CSS', 'style', descriptor.style || '', true));
        const revert = document.createElement('button'); revert.type = 'button'; revert.className = 'ink-imported-dom-revert'; revert.textContent = 'Revert this element';
        revert.addEventListener('click', () => this.revert()); body.appendChild(revert);
        this.settingsContainer.appendChild(body);
        header.querySelector('[data-import-back]').addEventListener('click', () => this.builder.openPanelScreen?.('elements'));
    }

    field(label, name, value, multiline = false) {
        const row = document.createElement('label'); row.className = 'ink-imported-dom-field';
        const title = document.createElement('span'); title.textContent = label;
        const input = document.createElement(multiline ? 'textarea' : 'input');
        input.value = value; input.dataset.importedField = name; if (multiline) input.rows = name === 'style' ? 5 : 3;
        input.addEventListener('input', () => this.preview(name, input.value));
        input.addEventListener('change', () => this.commit(name, input.value));
        row.append(title, input); return row;
    }

    preview(name, value) {
        this.active?.source?.postMessage({ type: 'ink-site-patch', path: this.active.path, patch: { [name]: value } }, '*');
    }

    commit(name, value) {
        if (!this.active) return;
        const node = this.runtime.document.get(this.active.node.id);
        const edits = structuredClone(node.settings.edits || []);
        const index = edits.findIndex((edit) => edit.path === this.active.path);
        const edit = index >= 0 ? edits[index] : { path: this.active.path };
        edit.patch = { ...(edit.patch || {}), [name]: value };
        if (index >= 0) edits[index] = edit; else edits.push(edit);
        this.runtime.update(node.id, { settings: { edits } }, `Edit imported ${this.active.descriptor.tag}`);
        this.active = null;
    }

    revert() {
        if (!this.active) return;
        const node = this.runtime.document.get(this.active.node.id);
        const edits = structuredClone(node.settings.edits || []).filter((edit) => edit.path !== this.active.path);
        this.runtime.update(node.id, { settings: { edits } }, `Revert imported ${this.active.descriptor.tag}`);
        this.active = null;
    }

    escape(value) {
        return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    }
}
