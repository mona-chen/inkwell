// Inline widget-behavior runtime. Emitted once per canvas render inside the canvas root so it
// ships in published output (getHtml clones the body). Uses event delegation on the iframe's
// document, so widgets added/replaced later are covered automatically. Keep this script free of
// ERB-sensitive tokens ({{ }}, <% %>) because the saved HTML is later rendered as a live template.
const WIDGET_RUNTIME = `
(function () {
  if (window.__inkWidgetsReady) { return; }
  window.__inkWidgetsReady = true;
  function closest (el, sel) { while (el && el.nodeType === 1) { if (el.matches(sel)) { return el; } el = el.parentNode; } return null; }
  function on (evt, sel, handler) { document.addEventListener(evt, function (event) { var target = closest(event.target, sel); if (target) { handler(event, target); } }, true); }

  /* Tabs */
  function activateTab (nav, index) {
    var tabs = Array.prototype.slice.call(nav.children);
    var panels = Array.prototype.slice.call(nav.parentElement.children).filter(function (child) { return child.classList.contains('ink-el-tab-panel'); });
    tabs.forEach(function (tab, i) { var active = i === index; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    panels.forEach(function (panel, i) { panel.hidden = i !== index; });
  }
  on('click', '.ink-el-tabs-nav button', function (event, button) {
    var nav = closest(button, '.ink-el-tabs-nav');
    if (!nav) { return; }
    activateTab(nav, Array.prototype.indexOf.call(nav.children, button));
  });
  on('keydown', '.ink-el-tabs-nav button', function (event, button) {
    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].indexOf(event.key) === -1) { return; }
    event.preventDefault();
    var nav = closest(button, '.ink-el-tabs-nav');
    if (!nav) { return; }
    var buttons = Array.prototype.slice.call(nav.children);
    var current = buttons.indexOf(button), next = current;
    if (event.key === 'ArrowRight') { next = (current + 1) % buttons.length; }
    else if (event.key === 'ArrowLeft') { next = (current - 1 + buttons.length) % buttons.length; }
    else if (event.key === 'Home') { next = 0; }
    else if (event.key === 'End') { next = buttons.length - 1; }
    buttons[next].focus(); activateTab(nav, next);
  });

  /* Carousel */
  function carouselCount (carousel) { return carousel.querySelectorAll('.ink-el-carousel-slide').length; }
  function carouselIndex (carousel) { return Number(carousel.getAttribute('data-index') || 0); }
  function renderCarousel (carousel) {
    var count = carouselCount(carousel);
    if (!count) { return; }
    var loop = carousel.getAttribute('data-loop') === 'true';
    var index = carouselIndex(carousel);
    if (index >= count) { index = loop ? 0 : count - 1; }
    if (index < 0) { index = loop ? count - 1 : 0; }
    carousel.setAttribute('data-index', String(index));
    var track = carousel.querySelector('.ink-el-carousel-track');
    if (track) { track.style.transform = 'translateX(' + (-index * 100) + '%)'; }
    carousel.querySelectorAll('[data-carousel-dot]').forEach(function (dot, i) { dot.classList.toggle('is-active', i === index); });
    carousel.querySelectorAll('.ink-el-carousel-nav').forEach(function (btn) {
      var disabled = !loop && ((btn.classList.contains('is-prev') && index === 0) || (btn.classList.contains('is-next') && index === count - 1));
      btn.disabled = disabled;
    });
  }
  function stepCarousel (carousel, delta) {
    var count = carouselCount(carousel);
    if (!count) { return; }
    var loop = carousel.getAttribute('data-loop') === 'true';
    var index = carouselIndex(carousel) + delta;
    if (!loop) { index = Math.max(0, Math.min(count - 1, index)); }
    carousel.setAttribute('data-index', String(index));
    renderCarousel(carousel);
  }
  on('click', '.ink-el-carousel .is-prev', function (event, button) { var c = closest(button, '.ink-el-carousel'); if (c) { stepCarousel(c, -1); } });
  on('click', '.ink-el-carousel .is-next', function (event, button) { var c = closest(button, '.ink-el-carousel'); if (c) { stepCarousel(c, 1); } });
  on('click', '[data-carousel-dot]', function (event, dot) {
    var c = closest(dot, '.ink-el-carousel');
    if (c) { c.setAttribute('data-index', String(Number(dot.getAttribute('data-index') || 0))); renderCarousel(c); }
  });
  function bindAutoplay (carousel) {
    if (carousel.getAttribute('data-autoplay-bound')) { return; }
    carousel.setAttribute('data-autoplay-bound', 'true');
    var interval = Math.max(500, Number(carousel.getAttribute('data-interval') || 4000));
    carousel.__inkTimer = setInterval(function () {
      if (!document.contains(carousel)) { clearInterval(carousel.__inkTimer); return; }
      if (carousel.getAttribute('data-hover') === 'true') { return; }
      stepCarousel(carousel, 1);
    }, interval);
  }
  function scanAutoplay () { Array.prototype.forEach.call(document.querySelectorAll('.ink-el-carousel[data-autoplay="true"]'), bindAutoplay); }
  if (window.MutationObserver) { var observer = new MutationObserver(scanAutoplay); observer.observe(document.body, { childList: true, subtree: true }); }
  scanAutoplay();

  /* Container background slideshow */
  function bindBackgroundSlideshow (slideshow) {
    if (slideshow.getAttribute('data-slideshow-bound')) { return; }
    var slides = Array.prototype.slice.call(slideshow.querySelectorAll('.ink-el-background-slide'));
    if (!slides.length) { return; }
    slideshow.setAttribute('data-slideshow-bound', 'true');
    var duration = Math.max(250, Number(slideshow.getAttribute('data-duration') || 5000));
    var loop = slideshow.getAttribute('data-loop') !== 'false';
    var index = 0;
    slideshow.style.setProperty('--ink-slide-duration', duration + 'ms');
    slides.forEach(function (slide, cursor) { slide.classList.toggle('is-active', cursor === 0); });
    if (slides.length < 2) { return; }
    slideshow.__inkSlideshowTimer = setInterval(function () {
      if (!document.contains(slideshow)) { clearInterval(slideshow.__inkSlideshowTimer); return; }
      if (!loop && index === slides.length - 1) { clearInterval(slideshow.__inkSlideshowTimer); return; }
      index = (index + 1) % slides.length;
      slides.forEach(function (slide, cursor) { slide.classList.toggle('is-active', cursor === index); });
    }, duration);
  }
  function scanBackgroundSlideshows () { Array.prototype.forEach.call(document.querySelectorAll('.ink-el-background-slideshow'), bindBackgroundSlideshow); }
  if (window.MutationObserver) { var slideshowObserver = new MutationObserver(scanBackgroundSlideshows); slideshowObserver.observe(document.body, { childList: true, subtree: true }); }
  scanBackgroundSlideshows();

  /* Gallery lightbox */
  var lightbox = null, lightboxSources = [], lightboxIndex = 0;
  function closeLightbox () { if (lightbox) { lightbox.remove(); lightbox = null; } }
  function renderLightbox () {
    if (!lightbox) { return; }
    var image = lightbox.querySelector('.ink-lightbox-image');
    image.src = lightboxSources[lightboxIndex];
    lightbox.querySelector('.ink-lightbox-prev').hidden = lightboxSources.length < 2;
    lightbox.querySelector('.ink-lightbox-next').hidden = lightboxSources.length < 2;
  }
  function openLightbox (sources, index) {
    closeLightbox();
    lightboxSources = sources; lightboxIndex = index;
    lightbox = document.createElement('div');
    lightbox.className = 'ink-lightbox';
    var image = document.createElement('img'); image.className = 'ink-lightbox-image'; image.alt = '';
    var close = document.createElement('button'); close.type = 'button'; close.className = 'ink-lightbox-close'; close.setAttribute('aria-label', 'Close'); close.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">close</span>';
    var prev = document.createElement('button'); prev.type = 'button'; prev.className = 'ink-lightbox-prev'; prev.setAttribute('aria-label', 'Previous'); prev.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>';
    var next = document.createElement('button'); next.type = 'button'; next.className = 'ink-lightbox-next'; next.setAttribute('aria-label', 'Next'); next.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>';
    lightbox.append(close, prev, image, next);
    document.body.appendChild(lightbox);
    renderLightbox();
  }
  on('click', '.ink-el-gallery[data-lightbox="true"] img', function (event, img) {
    var gallery = closest(img, '.ink-el-gallery');
    var images = Array.prototype.slice.call(gallery.querySelectorAll('img'));
    var sources = images.map(function (i) { return i.getAttribute('src') || ''; }).filter(Boolean);
    if (!sources.length) { return; }
    openLightbox(sources, images.indexOf(img));
  });
  on('click', '.ink-lightbox-close', closeLightbox);
  on('click', '.ink-lightbox', function (event) { if (event.target.classList.contains('ink-lightbox')) { closeLightbox(); } });
  on('click', '.ink-lightbox-prev', function () { lightboxIndex = (lightboxIndex - 1 + lightboxSources.length) % lightboxSources.length; renderLightbox(); });
  on('click', '.ink-lightbox-next', function () { lightboxIndex = (lightboxIndex + 1) % lightboxSources.length; renderLightbox(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') { closeLightbox(); } });
})();
`;

export default class CanvasRenderer {
    constructor({ registry, document, styles, selection, events } = {}) {
        this.registry = registry;
        this.document = document;
        this.styles = styles;
        this.selection = selection;
        this.events = events;
        this.instances = new Map();
        this.root = null;
        this.unsubscribers = [];
    }

    mount(root) {
        this.root = root;
        this.unsubscribers.push(this.events.on('document:insert', () => this.render()));
        this.unsubscribers.push(this.events.on('document:remove', ({ node }) => this.unmountTree(node)));
        this.unsubscribers.push(this.events.on('document:remove', () => this.render()));
        this.unsubscribers.push(this.events.on('document:move', () => this.render()));
        this.unsubscribers.push(this.events.on('document:update', ({ id }) => this.renderNode(id)));
        this.unsubscribers.push(this.events.on('document:settings', () => this.styles.mount(this.root.ownerDocument, this.document)));
        this.unsubscribers.push(this.events.on('document:replace', () => this.render()));
        this.render();
        return this;
    }

    create(node) {
        const definition = this.registry.get(node.type);
        const element = definition.render({ document: this.document, domDocument: this.root.ownerDocument, selection: this.selection }, node);
        if (!(element instanceof this.root.ownerDocument.defaultView.Element)) throw new Error(`${node.type}.render() must return a DOM Element.`);
        const kind = definition.kind || (definition.acceptsChildren ? (node.type === 'section' ? 'section' : node.type === 'column' ? 'column' : 'container') : 'widget');
        element.classList.add('ink-element', `ink-el-${node.id}`);
        element.dataset.inkElementId = node.id;
        element.dataset.inkElementType = node.type;
        element.dataset.inkKind = kind;
        element.draggable = !node.settings.locked;
        if (node.settings.hidden) element.dataset.inkHidden = '1';
        if (node.settings.locked) element.dataset.inkLocked = '1';
        element.addEventListener('click', (event) => { event.stopPropagation(); this.selection.select(node.id, { additive: event.shiftKey || event.metaKey || event.ctrlKey }); });
        element.addEventListener('pointerenter', () => this.selection.hover(node.id));
        element.addEventListener('pointerleave', () => this.selection.hover(null));
        if (definition.inlineEditable && !node.settings.locked) element.addEventListener('dblclick', (event) => this.startInlineEditing(event, element, node, definition));
        const childrenRoot = element.querySelector('[data-ink-children]') || element;
        (node.children || []).forEach((child) => childrenRoot.appendChild(this.create(child)));
        if (!node.children?.length && definition.acceptsChildren) childrenRoot.appendChild(this.emptyView(node, kind));
        element.appendChild(this.overlay(node, kind));
        if (node.type === 'columns') this.attachColumnResizes(element);
        const instance = { element, definition, node };
        this.instances.set(node.id, instance);
        definition.mount?.({ element, node, document: this.document });
        return element;
    }

    render() {
        if (!this.root) return;
        this.instances.forEach(({ definition, element, node }) => definition.unmount?.({ element, node }));
        this.instances.clear();
        this.root.replaceChildren(...this.document.data.children.map((node) => this.create(node)));
        if (!this.document.data.children.length) this.root.appendChild(this.rootEmptyView());
        else this.root.appendChild(this.widgetRuntime());
        this.styles.mount(this.root.ownerDocument, this.document);
        this.events.emit('canvas:render', { root: this.root });
    }

    widgetRuntime() {
        const doc = this.root.ownerDocument;
        const script = doc.createElement('script');
        script.dataset.inkWidgetRuntime = '';
        script.textContent = WIDGET_RUNTIME;
        return script;
    }

    actionButton(icon, label, action, id) {
        const button = this.root.ownerDocument.createElement('button');
        button.type = 'button'; button.title = label; button.dataset.inkAction = action;
        if (action === 'edit' && icon === 'drag_indicator') button.draggable = true;
        button.setAttribute('aria-label', label);
        button.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${icon}</span>`;
        button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.events.emit('element:action', { action, id }); });
        return button;
    }

    // Per-kind toolbar actions (Elementor contract):
    //   widget      -> move / edit / duplicate / delete
    //   column      -> move / edit / duplicate / delete (plus resize handles)
    //   container*  -> move / edit / add / duplicate / delete
    actionsFor(kind) {
        if (kind === 'container') return ['add', 'drag_indicator', 'delete'];
        if (kind === 'section') return ['drag_indicator', 'edit', 'add', 'content_copy', 'delete'];
        return ['drag_indicator', 'edit', 'content_copy', 'delete'];
    }

    overlay(node, kind) {
        const doc = this.root.ownerDocument;
        const overlay = doc.createElement('div'); overlay.className = 'ink-editor-overlay'; overlay.dataset.inkEditorOnly = ''; overlay.contentEditable = 'false';
        if (node.settings.locked) overlay.classList.add('is-locked');
        if (node.settings.hidden) overlay.classList.add('is-hidden');
        const toolbar = doc.createElement('div'); toolbar.className = 'ink-editor-toolbar';
        const labels = { drag_indicator: 'Move', edit: 'Edit', add: 'Add element', content_copy: 'Duplicate', delete: 'Delete' };
        this.actionsFor(kind).forEach((action) => {
            const icon = kind === 'container' && action === 'delete' ? 'close' : action;
            const button = this.actionButton(icon, labels[action], action, node.id);
            if (node.settings.locked) button.disabled = true;
            toolbar.appendChild(button);
        });
        overlay.appendChild(toolbar);
        return overlay;
    }

    // Attach resize handles to every direct column child once the columns root is built.
    attachColumnResizes(columnsRoot) {
        Array.from(columnsRoot.querySelectorAll(':scope > .ink-el-column')).forEach((column) => this.attachColumnResize(column));
    }

    // Column resize handles + live percentage feedback (Elementor's ui-resizable-e/w).
    attachColumnResize(columnEl) {
        const doc = this.root.ownerDocument;
        const columnsRoot = columnEl.parentElement;
        if (!columnsRoot?.classList.contains('ink-el-columns')) return;
        const columns = Array.from(columnsRoot.querySelectorAll(':scope > .ink-el-column'));
        const index = columns.indexOf(columnEl);
        if (index === -1) return;
        const makeHandle = (edge) => {
            const handle = doc.createElement('div'); handle.className = `ink-el-column-resize is-${edge}`; handle.dataset.inkEditorOnly = '';
            handle.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); this.startColumnResize(event, columnEl, columns, index, edge); });
            handle.addEventListener('mousedown', (event) => event.preventDefault());
            handle.addEventListener('dragstart', (event) => event.preventDefault());
            columnEl.appendChild(handle);
        };
        if (index > 0) makeHandle('w');
        if (index < columns.length - 1) makeHandle('e');
        if (!this.percentTooltip) {
            this.percentTooltip = doc.createElement('div'); this.percentTooltip.className = 'ink-el-column-percent'; this.percentTooltip.dataset.inkEditorOnly = '';
            doc.body.appendChild(this.percentTooltip);
        }
    }

    startColumnResize(event, columnEl, columns, index, edge) {
        event.preventDefault(); event.stopPropagation();
        const doc = this.root.ownerDocument;
        // Disable the native move drag so pointer events drive the resize.
        columnEl.dataset.inkWasDraggable = columnEl.draggable ? '1' : '0';
        columnEl.draggable = false;
        const rows = columns.map((c) => Number.parseFloat(c.getBoundingClientRect().width) || 0);
        const total = rows.reduce((a, b) => a + b, 0) || 1;
        const startX = event.clientX;
        const self = this;
        const neighbor = edge === 'e' ? index + 1 : index - 1;
        let liveRows = rows.slice();
        const move = (pointer) => {
            const delta = pointer.clientX - startX;
            const pairTotal = rows[index] + rows[neighbor];
            const minimum = Math.min(40, pairTotal * .45);
            let next = rows[index] + (edge === 'e' ? delta : -delta);
            next = Math.max(minimum, Math.min(pairTotal - minimum, next));
            liveRows = rows.slice(); liveRows[index] = next; liveRows[neighbor] = pairTotal - next;
            const percentages = liveRows.map((width) => (width / total) * 100);
            columns.forEach((column, columnIndex) => { column.style.flexBasis = `${percentages[columnIndex]}%`; });
            const pct = Math.round(percentages[index]);
            if (self.percentTooltip) { self.percentTooltip.textContent = `${pct}%`; const r = columnEl.getBoundingClientRect(); self.percentTooltip.style.left = `${r.left + r.width / 2}px`; self.percentTooltip.style.top = `${r.top}px`; self.percentTooltip.style.opacity = '1'; }
        };
        const stop = () => {
            doc.removeEventListener('pointermove', move); doc.removeEventListener('pointerup', stop);
            if (columnEl.dataset.inkWasDraggable === '1') columnEl.draggable = true;
            delete columnEl.dataset.inkWasDraggable;
            if (self.percentTooltip) self.percentTooltip.style.opacity = '0';
            if (liveRows.some((width, columnIndex) => Math.abs(width - rows[columnIndex]) > .01)) {
                const percentages = liveRows.map((width) => Math.round((width / total) * 10000) / 100);
                const drift = Math.round((100 - percentages.reduce((sum, width) => sum + width, 0)) * 100) / 100;
                percentages[percentages.length - 1] += drift;
                const columnsEl = columnEl.parentElement;
                if (columnsEl?.dataset?.inkElementId) self.events.emit('element:resize', { id: columnsEl.dataset.inkElementId, structure: percentages.join(',') });
            }
        };
        doc.addEventListener('pointermove', move); doc.addEventListener('pointerup', stop);
    }

    // Ink structure presets — rendered as a wide visual gallery state (Elementor's
    // `e-con-select-preset`), not an overlapping popover.
    presetGallery(parentId) {
        const presets = [['100', 'Single'], ['50,50', '1/2 · 1/2'], ['33,33,33', '1/3 · 1/3 · 1/3'], ['25,25,25,25', '1/4 × 4'], ['60,40', '60 / 40'], ['40,60', '40 / 60'], ['25,50,25', '25 / 50 / 25'], ['66,34', '66 / 34']];
        const doc = this.root.ownerDocument;
        const gallery = doc.createElement('div'); gallery.className = 'ink-empty-presets'; gallery.hidden = true;
        const header = doc.createElement('div'); header.className = 'ink-empty-presets-header';
        const back = doc.createElement('button'); back.type = 'button'; back.className = 'ink-empty-back'; back.setAttribute('aria-label', 'Back'); back.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>';
        back.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.setState(gallery, 'actions'); });
        const title = doc.createElement('span'); title.className = 'ink-empty-presets-title'; title.textContent = 'Choose a structure';
        header.append(back, title); gallery.appendChild(header);
        const list = doc.createElement('div'); list.className = 'ink-empty-preset-list';
        presets.forEach(([structure, label]) => {
            const button = doc.createElement('button'); button.type = 'button'; button.className = 'ink-empty-preset';
            button.innerHTML = `<span class="ink-empty-preset-bars" aria-hidden="true">${structure.split(',').map((w) => `<i style="flex:${w}"></i>`).join('')}</span><span>${label}</span>`;
            button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.events.emit('element:insert-structure', { parentId, structure }); });
            list.appendChild(button);
        });
        gallery.appendChild(list);
        return gallery;
    }

    setState(gallery, state) {
        const surface = gallery.closest('.ink-editor-empty, .ink-editor-root-empty');
        if (!surface) return;
        surface.dataset.inkEmptyState = state;
        gallery.hidden = state !== 'presets';
    }

    emptySurface(parentId, root) {
        const doc = this.root.ownerDocument;
        const view = doc.createElement('div'); view.className = root ? 'ink-editor-root-empty' : 'ink-editor-empty'; view.dataset.inkEditorOnly = ''; view.dataset.inkEmptyState = 'actions';
        const actions = doc.createElement('div'); actions.className = 'ink-empty-actions';
        const add = doc.createElement('button'); add.type = 'button'; add.className = 'ink-empty-action is-primary'; add.dataset.emptyAction = 'add'; add.title = 'Add element'; add.setAttribute('aria-label', 'Add element'); add.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">add</span>';
        add.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.events.emit('element:action', { action: 'add', id: parentId }); });
        const structure = doc.createElement('button'); structure.type = 'button'; structure.className = 'ink-empty-action'; structure.dataset.emptyAction = 'structure'; structure.title = 'Add container / structure'; structure.setAttribute('aria-label', 'Add container or structure'); structure.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">view_column</span>';
        structure.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); const gallery = view.querySelector('.ink-empty-presets'); if (gallery) this.setState(gallery, 'presets'); });
        actions.append(add, structure);
        const caption = doc.createElement('span'); caption.className = 'ink-empty-caption'; caption.textContent = 'Drag widgets here';
        view.append(actions, caption, this.presetGallery(parentId));
        return view;
    }

    emptyView(node, kind) {
        return this.emptySurface(node.id, false);
    }

    rootEmptyView() {
        return this.emptySurface(null, true);
    }

    startInlineEditing(event, element, node, definition) {
        event.preventDefault(); event.stopPropagation();
        const target = typeof definition.inlineEditable === 'string' && definition.inlineEditable !== 'text' ? element.querySelector(definition.inlineEditable) : element;
        if (!target || target.dataset.inkInlineEditing === 'true') return;
        const original = node.settings.text || ''; target.dataset.inkInlineEditing = 'true'; target.contentEditable = 'true'; element.draggable = false; this.selection.select(node.id); target.focus();
        const selection = target.ownerDocument.getSelection(); const range = target.ownerDocument.createRange(); const textNode = [...target.childNodes].find((child) => child.nodeType === Node.TEXT_NODE); textNode ? range.selectNodeContents(textNode) : range.selectNodeContents(target); selection.removeAllRanges(); selection.addRange(range);
        const readText = () => { const clone = target.cloneNode(true); clone.querySelectorAll('[data-ink-editor-only]').forEach((item) => item.remove()); return clone.textContent; };
        const finish = (commit = true) => { if (target.dataset.inkInlineEditing !== 'true') return; delete target.dataset.inkInlineEditing; target.removeAttribute('contenteditable'); element.draggable = true; const text = readText(); if (commit && text !== original) this.events.emit('element:inline-change', { id: node.id, text }); else if (!commit) { [...target.childNodes].filter((child) => !child.dataset?.inkEditorOnly).forEach((child) => child.remove()); target.prepend(target.ownerDocument.createTextNode(original)); } };
        target.addEventListener('blur', () => finish(true), { once: true });
        target.addEventListener('keydown', (keyEvent) => { if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); finish(false); target.blur(); } else if (keyEvent.key === 'Enter' && node.type === 'heading' && !keyEvent.shiftKey) { keyEvent.preventDefault(); target.blur(); } });
    }

    renderNode(id) {
        const instance = this.instances.get(id);
        const node = this.document.get(id);
        if (!instance || !node) return this.render();
        const replacement = this.create(node);
        instance.definition.unmount?.({ element: instance.element, node: instance.node });
        instance.element.replaceWith(replacement);
        this.styles.mount(this.root.ownerDocument, this.document);
        this.events.emit('canvas:update', { id, element: replacement });
    }

    unmountTree(node) {
        (node.children || []).forEach((child) => this.unmountTree(child));
        const instance = this.instances.get(node.id);
        instance?.definition.unmount?.({ element: instance.element, node: instance.node });
        this.instances.delete(node.id);
    }

    destroy() {
        this.unsubscribers.forEach((unsubscribe) => unsubscribe());
        this.unsubscribers = [];
        this.document.data.children.forEach((node) => this.unmountTree(node));
        this.root = null;
    }
}
