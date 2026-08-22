export default class FinderManager {
    constructor(runtime) { this.runtime = runtime; }
    mount() {
        this.dialog = document.createElement('div'); this.dialog.className = 'ink-finder'; this.dialog.hidden = true;
        const surface = document.createElement('div'); surface.className = 'ink-finder-surface'; surface.setAttribute('role', 'dialog'); surface.setAttribute('aria-modal', 'true'); surface.setAttribute('aria-label', 'Finder');
        const search = document.createElement('div'); search.className = 'ink-finder-search'; search.innerHTML = '<span class="material-symbols-rounded">search</span>';
        this.input = document.createElement('input'); this.input.type = 'search'; this.input.placeholder = 'Find elements or widgets…'; search.appendChild(this.input);
        this.results = document.createElement('div'); this.results.className = 'ink-finder-results'; surface.append(search, this.results); this.dialog.appendChild(surface); document.body.appendChild(this.dialog);
        this.input.addEventListener('input', () => this.render()); this.input.addEventListener('keydown', (event) => { if (event.key === 'Escape') this.hide(); if (event.key === 'Enter') this.results.querySelector('button')?.click(); });
        this.dialog.addEventListener('pointerdown', (event) => { if (event.target === this.dialog) this.hide(); }); return this;
    }
    toggle() { this.dialog.hidden ? this.show() : this.hide(); }
    show() { this.dialog.hidden = false; this.input.value = ''; this.render(); this.input.focus(); }
    hide() { this.dialog.hidden = true; }
    render() {
        const query = this.input.value.trim().toLowerCase(); this.results.replaceChildren();
        const group = (title) => { const section = document.createElement('section'); section.innerHTML = `<h3>${title}</h3>`; this.results.appendChild(section); return section; };
        const definitions = this.runtime.elements.list().filter((item) => `${item.title} ${item.category} ${(item.keywords || []).join(' ')}`.toLowerCase().includes(query)).slice(0, 12);
        if (definitions.length) {
            const section = group('Add element');
            const selected = this.runtime.selection.selectedId && this.runtime.document.get(this.runtime.selection.selectedId);
            definitions.forEach((definition) => {
                const button = document.createElement('button'); button.type = 'button';
                button.innerHTML = `<span class="material-symbols-rounded">${definition.icon}</span><span><strong>${definition.title}</strong><small>${selected && this.runtime.elements.accepts(selected, this.runtime.create(definition.type)) ? `Insert into ${selected.settings.label || selected.settings.text || this.runtime.elements.get(selected.type).title}` : definition.category}</small></span>`;
                button.addEventListener('click', () => {
                    let overrides = {};
                    if (definition.type === 'columns') overrides = { settings: { structure: '50,50' }, children: [this.runtime.create('column'), this.runtime.create('column')] };
                    const candidate = this.runtime.create(definition.type, overrides);
                    const target = selected && this.runtime.elements.accepts(selected, candidate) ? { parentId: selected.id } : {};
                    const node = this.runtime.insert(definition.type, target, overrides);
                    this.runtime.selection.select(node.id);
                    this.hide();
                });
                section.appendChild(button);
            });
        }
        const matches = []; const visit = (node) => { const definition = this.runtime.elements.get(node.type); if (`${node.settings.label || node.settings.text || definition.title} ${definition.title}`.toLowerCase().includes(query)) matches.push({ node, definition }); (node.children || []).forEach(visit); }; this.runtime.document.data.children.forEach(visit);
        if (matches.length) { const section = group('On this page'); matches.slice(0, 12).forEach(({ node, definition }) => { const button = document.createElement('button'); button.type = 'button'; button.innerHTML = `<span class="material-symbols-rounded">${definition.icon}</span><span><strong>${node.settings.label || node.settings.text || definition.title}</strong><small>${definition.title}</small></span>`; button.addEventListener('click', () => { this.runtime.selection.select(node.id); this.runtime.canvas.instances.get(node.id)?.element.scrollIntoView({ behavior:'smooth', block:'center' }); this.hide(); }); section.appendChild(button); }); }
        if (!this.results.children.length) this.results.innerHTML = '<p class="ink-finder-empty">No matching elements.</p>';
    }
    destroy() { this.dialog?.remove(); }
}
