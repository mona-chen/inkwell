import { elementorShapeMarkup } from './elementorShapes.js';

const text = (domDocument, tag, className, value) => {
    const element = domDocument.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
};
import { renderIcon } from './icons.js';

function renderShapeDivider(domDocument, side, settings = {}) {
    const value = settings[`shapeDivider${side[0].toUpperCase()}${side.slice(1)}`];
    const markup = value?.type && elementorShapeMarkup(value.type, value.invert);
    if (!markup) return null;
    const shape = domDocument.createElement('div'); shape.className = `ink-el-shape-divider ink-el-shape-divider-${side}`;
    shape.style.setProperty('--ink-shape-color', value.color || '#ffffff');
    shape.style.setProperty('--ink-shape-width', `${Number(value.width) || 100}%`);
    shape.style.setProperty('--ink-shape-height', `${Number(value.height) || 100}px`);
    if (value.flip) shape.classList.add('is-flipped');
    shape.dataset.negative = value.invert ? 'true' : 'false';
    if (value.front) shape.classList.add('is-front');
    shape.innerHTML = markup;
    shape.querySelector('svg')?.setAttribute('aria-hidden', 'true');
    return shape;
}

const youtubeId = (url = '') => url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)?.[1];
const vimeoId = (url = '') => url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];

function renderBackgroundMedia(domDocument, node) {
    const base = node.styles?.desktop?.base || node.styles?.base || {};
    const mode = base['--ink-background-type'];
    if (mode === 'video') {
        const value = node.settings.backgroundVideo || {
            url: node.settings.backgroundVideoUrl,
            start: node.settings.backgroundVideoStart,
            end: node.settings.backgroundVideoEnd,
            playOnce: node.settings.backgroundVideoPlayOnce,
            playOnMobile: node.settings.backgroundVideoPlayOnMobile,
            privacy: node.settings.backgroundVideoPrivacy,
            fallback: typeof node.settings.backgroundVideoFallback === 'object' ? node.settings.backgroundVideoFallback?.url : node.settings.backgroundVideoFallback,
        };
        if (!value.url && !value.fallback) return null;
        const layer = domDocument.createElement('div'); layer.className = 'ink-el-background-media ink-el-background-video';
        if (value.fallback) layer.style.backgroundImage = `url("${String(value.fallback).replaceAll('"', '\\"')}")`;
        const yt = youtubeId(value.url); const vm = vimeoId(value.url);
        if (yt || vm) {
            const iframe = domDocument.createElement('iframe'); iframe.title = 'Background video'; iframe.tabIndex = -1; iframe.setAttribute('aria-hidden', 'true'); iframe.allow = 'autoplay; fullscreen';
            iframe.src = yt
                ? `https://${value.privacy ? 'www.youtube-nocookie.com' : 'www.youtube.com'}/embed/${yt}?autoplay=1&mute=1&controls=0&playsinline=1&loop=${value.playOnce ? 0 : 1}&playlist=${yt}&start=${Number(value.start) || 0}${value.end ? `&end=${Number(value.end)}` : ''}`
                : `https://player.vimeo.com/video/${vm}?background=1&autoplay=1&muted=1&loop=${value.playOnce ? 0 : 1}`;
            layer.appendChild(iframe);
        } else if (value.url) {
            const video = domDocument.createElement('video'); video.autoplay = true; video.muted = true; video.playsInline = true; video.loop = !value.playOnce; video.tabIndex = -1; video.setAttribute('aria-hidden', 'true');
            const start = Number(value.start) || 0; const end = Number(value.end) || 0; video.src = `${value.url}${start || end ? `#t=${start}${end ? `,${end}` : ''}` : ''}`; layer.appendChild(video);
        }
        if (value.playOnMobile === false) layer.classList.add('is-desktop-only');
        return layer;
    }
    if (mode === 'slideshow') {
        const value = node.settings.backgroundSlideshow || {
            images: node.settings.backgroundSlideshowImages,
            loop: node.settings.backgroundSlideshowLoop !== false,
            duration: node.settings.backgroundSlideshowDuration,
            transition: node.settings.backgroundSlideshowTransition,
            transitionDuration: node.settings.backgroundSlideshowTransitionDuration,
            size: node.settings.backgroundSlideshowSize,
            position: node.settings.backgroundSlideshowPosition,
            lazyload: node.settings.backgroundSlideshowLazyload,
            kenBurns: node.settings.backgroundSlideshowKenBurns,
            zoomDirection: node.settings.backgroundSlideshowZoomDirection,
        }; const images = Array.isArray(value.images) ? value.images : [];
        if (!images.length) return null;
        const layer = domDocument.createElement('div'); layer.className = `ink-el-background-media ink-el-background-slideshow is-${value.transition || 'fade'}`;
        layer.dataset.duration = String(Math.max(250, Number(value.duration) || 5000)); layer.dataset.loop = String(value.loop !== false); layer.style.setProperty('--ink-slide-transition', `${Math.max(0, Number(value.transitionDuration) || 500)}ms`);
        images.forEach((image, index) => {
            const url = typeof image === 'string' ? image : image?.url; if (!url) return;
            const slide = domDocument.createElement('div'); slide.className = `ink-el-background-slide${index === 0 ? ' is-active' : ''}`;
            const imageElement = domDocument.createElement('img'); imageElement.src = url; imageElement.alt = ''; imageElement.loading = value.lazyload ? 'lazy' : 'eager'; imageElement.decoding = 'async'; imageElement.style.objectFit = value.size === 'contain' ? 'contain' : value.size === 'auto' ? 'none' : 'cover'; imageElement.style.objectPosition = value.position || 'center center';
            if (value.kenBurns) imageElement.classList.add('has-ken-burns', value.zoomDirection === 'out' ? 'is-zoom-out' : 'is-zoom-in'); slide.appendChild(imageElement); layer.appendChild(slide);
        });
        return layer;
    }
    return null;
}

// Ink-style shell: boxed (inner content limited to the site content width) or full-width.
// The inner wrapper is the drop target for child elements.
function renderShell(domDocument, node, rootClass, tag = 'div') {
    const root = domDocument.createElement(node.settings.tag || tag);
    root.className = rootClass;
    const layout = node.settings.layout || 'boxed';
    root.classList.add(`is-${layout}`);
    const overlay = domDocument.createElement('div'); overlay.className = `${rootClass}-overlay`; overlay.setAttribute('aria-hidden', 'true');
    const inner = domDocument.createElement('div'); inner.className = `${rootClass}-inner`; inner.dataset.inkChildren = '';
    const topShape = renderShapeDivider(domDocument, 'top', node.settings);
    const bottomShape = renderShapeDivider(domDocument, 'bottom', node.settings);
    const backgroundMedia = renderBackgroundMedia(domDocument, node);
    if (topShape) root.appendChild(topShape);
    if (backgroundMedia) root.appendChild(backgroundMedia);
    root.append(overlay, inner);
    if (bottomShape) root.appendChild(bottomShape);
    return root;
}

// Frames are the universal visual primitive. Unlike page Containers they do not impose
// a page-width contract, but they do own a surface, an optional overlay, and a child-layout
// root so Freeform, Stack, and Grid remain interchangeable without changing the tree.
function renderFrame(domDocument, node) {
    const link = typeof node.settings?.link === 'object' ? node.settings.link : { url: node.settings?.link };
    const root = domDocument.createElement(link?.url ? 'a' : (node.settings.tag || 'div'));
    root.className = 'ink-el-frame';
    if (root.tagName === 'A' && link?.url) {
        root.href = link.url;
        root.target = link.isExternal ? '_blank' : '_self';
        if (link.nofollow) root.rel = 'nofollow';
    }
    const overlay = domDocument.createElement('div'); overlay.className = 'ink-el-frame-overlay'; overlay.setAttribute('aria-hidden', 'true');
    const inner = domDocument.createElement('div'); inner.className = 'ink-el-frame-inner'; inner.dataset.inkChildren = '';
    root.append(overlay, inner);
    return root;
}

const layoutControls = [
    { tab: 'content', target: 'styles', section: 'Layout', name: 'display', type: 'choose', label: 'Display', options: ['flex', 'grid', 'block'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'flex-direction', type: 'choose', label: 'Direction', options: ['row', 'column'], responsive: true, condition: { display: 'flex' } },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'flex-wrap', type: 'choose', label: 'Wrap', options: ['nowrap', 'wrap', 'wrap-reverse'], responsive: true, condition: { display: 'flex' } },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'justify-content', type: 'choose', label: 'Justify content', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'align-items', type: 'choose', label: 'Align items', options: ['stretch', 'flex-start', 'center', 'flex-end'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'align-content', type: 'select', label: 'Align content', options: ['normal', 'stretch', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'gap', type: 'gaps', label: 'Row / column gap', units: ['px', 'rem', '%', 'vw'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Grid', name: 'grid-template-columns', type: 'text', label: 'Columns', responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Grid', name: 'grid-template-rows', type: 'text', label: 'Rows', responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Grid', name: 'grid-auto-flow', type: 'select', label: 'Auto flow', options: ['row', 'column', 'dense', 'row dense', 'column dense'], responsive: true, condition: { display: 'grid' } },
];

// Modern container controls. Child layout styles target the inner wrapper because it
// is the direct parent of the elements placed inside a boxed or full-width container.
const containerLayoutControls = [
    { tab: 'content', target: 'styles', section: 'Container', name: '__layout-flow', type: 'layout-flow', label: 'Flow', responsive: true },
    { tab: 'content', section: 'Container', name: 'layout', type: 'select', label: 'Content Width', options: [{ value: 'boxed', label: 'Boxed' }, { value: 'full', label: 'Full Width' }] },
    { tab: 'content', target: 'styles', section: 'Container', name: 'boxed-width', type: 'slider', label: 'Width', min: 500, max: 1600, default: 1140, units: ['px', '%', 'em', 'rem', 'vw'], responsive: true, condition: { layout: 'boxed' } },
    { tab: 'content', target: 'styles', section: 'Container', name: '__alignment-gap', type: 'alignment-gap', label: 'Alignment and gap', hideLabel: true, responsive: true, units: ['px', '%', 'em', 'rem', 'vw'] },
    { tab: 'content', target: 'styles', section: 'Container', name: 'grid-template-columns', type: 'text', label: 'Columns', responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'grid-template-rows', type: 'text', label: 'Rows', responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'grid-auto-flow', type: 'select', label: 'Auto Flow', options: ['row', 'column'], responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'justify-items', type: 'choose', label: 'Justify Items', options: [{ value: 'start', label: 'Start', icon: 'align_horizontal_left' }, { value: 'center', label: 'Center', icon: 'align_horizontal_center' }, { value: 'end', label: 'End', icon: 'align_horizontal_right' }, { value: 'stretch', label: 'Stretch', icon: 'width' }], responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Additional Options', name: 'overflow', type: 'select', label: 'Overflow', options: [{ value: '', label: 'Default' }, { value: 'hidden', label: 'Hidden' }, { value: 'auto', label: 'Auto' }] },
    { tab: 'content', section: 'Additional Options', name: 'tag', type: 'select', label: 'HTML Tag', options: ['div', 'header', 'footer', 'main', 'article', 'section', 'aside', 'nav'] },
];

const advancedControls = [
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'margin', type: 'dimensions', label: 'Margin', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'padding', type: 'dimensions', label: 'Padding', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: '__resizing', type: 'resizing', label: 'Resizing', hideLabel: true, responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'min-width', type: 'size', label: 'Minimum width', units: ['px', '%', 'vw', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'max-width', type: 'size', label: 'Maximum width', units: ['px', '%', 'vw', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'min-height', type: 'size', label: 'Minimum height', units: ['px', '%', 'vh', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'max-height', type: 'size', label: 'Maximum height', units: ['px', '%', 'vh', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'aspect-ratio', type: 'text', label: 'Aspect ratio', placeholder: '16 / 9', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'overflow', type: 'select', label: 'Overflow', options: ['visible', 'hidden', 'auto', 'scroll', 'clip'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: '__positioning', type: 'positioning', label: 'Positioning', hideLabel: true, responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: 'z-index', type: 'number', label: 'Z-index', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'translate', type: 'text', label: 'Translate', placeholder: '0px 0px', responsive: true, states: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'rotate', type: 'size', label: 'Rotate', units: ['deg', 'turn'], responsive: true, states: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'scale', type: 'number', label: 'Scale', responsive: true, states: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'transform', type: 'text', label: 'Skew / custom transform', placeholder: 'skew(8deg, 0deg)', responsive: true, states: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'transform-origin', type: 'text', label: 'Origin', placeholder: 'center center', responsive: true, states: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'perspective', type: 'size', label: 'Perspective', units: ['px', 'vw'], responsive: true, states: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'backface-visibility', type: 'choose', label: 'Backface', options: [{ value: 'visible', label: 'Visible' }, { value: 'hidden', label: 'Hidden' }], states: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'transform-style', type: 'choose', label: '3D children', options: [{ value: 'flat', label: 'Flat' }, { value: 'preserve-3d', label: 'Preserve 3D' }], states: true },
    { tab: 'advanced', target: 'styles', section: 'Flex item', name: 'align-self', type: 'select', label: 'Align self', options: ['auto', 'stretch', 'flex-start', 'center', 'flex-end'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Flex item', name: 'order', type: 'number', label: 'Order', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Flex item', name: 'flex-grow', type: 'number', label: 'Grow', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Flex item', name: 'flex-shrink', type: 'number', label: 'Shrink', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Effects', name: 'opacity', type: 'slider', label: 'Opacity', min: 0, max: 1, step: 0.05, default: 1, responsive: true, states: true },
    { tab: 'advanced', target: 'styles', section: 'Effects', name: 'filter', type: 'css-filters', label: 'CSS filters' },
    { tab: 'advanced', target: 'styles', section: 'Interaction', name: 'cursor', type: 'select', label: 'Cursor', options: ['auto', 'default', 'pointer', 'text', 'grab', 'grabbing', 'crosshair', 'move', 'not-allowed', 'zoom-in', 'zoom-out', 'none'] },
    { tab: 'advanced', target: 'settings', section: 'Motion', name: 'motion', type: 'motion', label: 'Animation', description: 'Native keyframes run in Preview and published pages; Design mode stays stable and editable.' },
];

const surfaceControls = [
    { tab: 'style', target: 'styles', section: 'Fill', name: 'background', type: 'background', label: 'Fill', states: ['base', 'hover'] },
    { tab: 'style', target: 'styles', section: 'Appearance', name: 'border-radius', type: 'dimensions', label: 'Corner radius', units: ['px', '%', 'em', 'rem'], responsive: true, states: ['base', 'hover'] },
    { tab: 'style', target: 'styles', section: 'Stroke', name: 'border', type: 'border', label: 'Stroke', states: ['base', 'hover'] },
    { tab: 'style', target: 'styles', section: 'Effects', name: 'box-shadow', type: 'box-shadow', label: 'Drop shadow', states: ['base', 'hover'] },
];

const containerSurfaceControls = [
    surfaceControls[0],
    { tab: 'style', target: 'settings', section: 'Fill', name: 'importedBackgroundImageId', type: 'imported-background', label: 'Imported image layer', condition: { importedBackgroundImageId: '__not_empty__' }, description: 'Changes the original imported artwork while preserving its mask, blend mode, placement, and responsive layout.' },
    { tab: 'style', target: 'styles', section: 'Overlay', name: 'background-overlay', type: 'background', label: 'Overlay fill', part: 'overlay', states: ['base', 'hover'] },
    ...surfaceControls.slice(1),
    { tab: 'style', target: 'settings', section: 'Decorations', name: 'shape-divider', type: 'shape-divider', label: 'Shape divider' },
];

// Single typography popover (Ink) writing to the element's style bucket.
const typographyControls = {
    tab: 'style', target: 'styles', section: 'Typography', name: 'typography', type: 'typography', label: 'Typography',
};

export default function registerInkFoundationElements(registry) {
    registry.register({
        type: 'container', title: 'Container', icon: 'view_column', category: 'Layout', acceptsChildren: true,
        defaults: { settings: { tag: 'div', layout: 'boxed' }, styles: { base: { display: 'flex', 'flex-direction': 'column', width: '100%', padding: { top: 10, right: 10, bottom: 10, left: 10, unit: 'px' }, gap: { row: 20, column: 20, unit: 'px' } } }, children: [] },
        tabLabels: { content: 'Layout' },
        tabIcons: { content: 'view_column' },
        selectors: { root: '&', inner: '.ink-el-container-inner', overlay: '.ink-el-container-overlay' },
        styleMap: {
            display: { part: 'inner' },
            'flex-direction': { part: 'inner' },
            'flex-wrap': { part: 'inner' },
            'justify-content': { part: 'inner' },
            'align-items': { part: 'inner' },
            'align-content': { part: 'inner' },
            gap: { part: 'inner' },
            'grid-template-columns': { part: 'inner' },
            'grid-template-rows': { part: 'inner' },
            'grid-auto-flow': { part: 'inner' },
            'justify-items': { part: 'inner' },
            'boxed-width': { part: 'inner', property: 'max-width' },
            '--ink-background-type': () => ({}),
            '--ink-overlay-background-type': () => ({}),
            'overlay-background-color': { part: 'overlay', property: 'background-color' },
            'overlay-background-image': { part: 'overlay', property: 'background-image' },
            'overlay-background-size': { part: 'overlay', property: 'background-size' },
            'overlay-background-position': { part: 'overlay', property: 'background-position' },
            'overlay-background-repeat': { part: 'overlay', property: 'background-repeat' },
            'overlay-background-attachment': { part: 'overlay', property: 'background-attachment' },
            'overlay-opacity': { part: 'overlay', property: 'opacity' },
            'overlay-mix-blend-mode': { part: 'overlay', property: 'mix-blend-mode' },
            'overlay-filter': { part: 'overlay', property: 'filter' },
            'background-transition-duration': { property: '--ink-background-transition', transform: (value) => `${Number(value?.size ?? value) || 0}s` },
            'overlay-transition-duration': { part: 'overlay', property: '--ink-overlay-transition', transform: (value) => `${Number(value?.size ?? value) || 0}s` },
            'border-transition-duration': { property: '--ink-border-transition', transform: (value) => `${Number(value?.size ?? value) || 0}s` },
        },
        controls: [
            ...containerLayoutControls,
            ...containerSurfaceControls,
            ...advancedControls.filter((control) => !['__resizing', 'overflow'].includes(control.name)),
        ],
        render: ({ domDocument }, node) => renderShell(domDocument, node, 'ink-el-container', 'div'),
    });
    registry.register({
        type: 'frame', title: 'Frame', icon: 'crop_landscape', category: 'Layout', acceptsChildren: true,
        // A Frame is the universal visual/layout primitive. It starts in Freeform mode
        // (the familiar Figma/Framer canvas behaviour); authors intentionally switch it
        // to vertical/horizontal Stack or Grid with the Flow control when children should
        // participate in document flow.
        // Empty Frames are deliberate transparent layout/positioning surfaces, not legacy
        // widget buckets. Selection chrome makes them discoverable; the author chooses whether
        // to give them a fill, child content, or freeform absolute children.
        defaults: { settings: { tag: 'div', label: 'Frame' }, styles: { base: { display: 'block', width: 'fit-content', height: 'fit-content', 'min-width': { size: 120, unit: 'px' }, 'min-height': { size: 80, unit: 'px' }, position: 'relative' } }, children: [] },
        showEmptyView: false,
        selectors: { root: '&', inner: '.ink-el-frame-inner', overlay: '.ink-el-frame-overlay' },
        styleMap: {
            display: { part: 'inner' }, 'flex-direction': { part: 'inner' }, 'flex-wrap': { part: 'inner' }, 'justify-content': { part: 'inner' }, 'align-items': { part: 'inner' }, 'align-content': { part: 'inner' }, gap: { part: 'inner' },
            'grid-template-columns': { part: 'inner' }, 'grid-template-rows': { part: 'inner' }, 'grid-auto-flow': { part: 'inner' }, 'justify-items': { part: 'inner' },
            'overlay-background-color': { part: 'overlay', property: 'background-color' }, 'overlay-background-image': { part: 'overlay', property: 'background-image' }, 'overlay-background-size': { part: 'overlay', property: 'background-size' }, 'overlay-background-position': { part: 'overlay', property: 'background-position' }, 'overlay-background-repeat': { part: 'overlay', property: 'background-repeat' }, 'overlay-opacity': { part: 'overlay', property: 'opacity' }, 'overlay-mix-blend-mode': { part: 'overlay', property: 'mix-blend-mode' }, 'overlay-filter': { part: 'overlay', property: 'filter' }, 'overlay-transition-duration': { part: 'overlay', property: '--ink-overlay-transition', transform: 'seconds' },
        },
        controls: [
            { tab: 'content', target: 'styles', section: 'Frame', name: '__layout-flow', type: 'layout-flow', label: 'Flow', responsive: true },
            { tab: 'content', target: 'styles', section: 'Frame', name: '__alignment-gap', type: 'alignment-gap', label: 'Alignment and gap', hideLabel: true, responsive: true, units: ['px', '%', 'em', 'rem', 'vw'] },
            { tab: 'content', section: 'Link', name: 'link', type: 'url', label: 'Link to' },
            { tab: 'content', section: 'Semantics', name: 'tag', type: 'select', label: 'HTML tag', options: ['div', 'a', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside'] },
            surfaceControls[0],
            { tab: 'style', target: 'styles', section: 'Overlay', name: 'background-overlay', type: 'background', label: 'Overlay fill', part: 'overlay', states: ['base', 'hover'] },
            ...surfaceControls.slice(1),
            ...advancedControls.filter((control) => control.name !== '__resizing'),
        ],
        render: ({ domDocument }, node) => renderFrame(domDocument, node),
    });
    registry.register({
        // Groups are organizational only. They deliberately have no box, styling, layout,
        // or drop-zone of their own: their bounds are the collection of their children.
        // A real visual or layout container must be a Frame.
        type: 'group', title: 'Group', icon: 'group', category: 'Organization', acceptsChildren: true, internal: true,
        showEmptyView: false, showEditorOverlay: false,
        defaults: { settings: { label: 'Group', grouping: true }, styles: { base: { display: 'contents' } }, children: [] },
        controls: [
            { tab: 'content', section: 'Group', name: 'label', type: 'text', label: 'Layer name' },
        ],
        render: ({ domDocument }) => { const element = domDocument.createElement('div'); element.className = 'ink-el-group'; element.dataset.inkChildren = ''; return element; },
    });
    registry.register({
        type: 'div', title: 'Div Block', icon: 'check_box_outline_blank', category: 'Layout', acceptsChildren: true,
        defaults: { settings: { tag: 'div' }, styles: { base: { display: 'block' } }, children: [] },
        controls: [
            ...layoutControls,
            { tab: 'content', section: 'Additional Options', name: 'tag', type: 'select', label: 'HTML tag', options: ['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside'] },
            ...surfaceControls,
            ...advancedControls,
        ],
        render: ({ domDocument }, node) => { const el = domDocument.createElement(node.settings.tag || 'div'); el.dataset.inkChildren = ''; return el; },
    });
    registry.register({
        type: 'heading', title: 'Heading', icon: 'title', category: 'Basic', inlineEditable: 'text',
        defaults: { settings: { text: 'Heading', tag: 'h2', size: '', link: '' }, styles: { base: {} } },
        selectors: { root: '&', link: '.ink-el-heading-link' },
        controls: [
            { tab: 'content', section: 'Content', name: 'text', type: 'text', label: 'Title' },
            { tab: 'content', section: 'Content', name: 'tag', type: 'select', label: 'HTML tag', options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p'] },
            { tab: 'content', section: 'Content', name: 'size', type: 'choose', label: 'Size', options: [{ value: '', label: 'Default' }, { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }, { value: 'xl', label: 'XL' }, { value: 'xxl', label: 'XXL' }] },
            { tab: 'content', section: 'Content', name: 'link', type: 'url', label: 'Link' },
            typographyControls,
            { tab: 'style', target: 'styles', section: 'Typography', name: 'color', type: 'color', label: 'Color', states: true },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'text-align', type: 'choose', label: 'Alignment', options: [{ value: 'left', icon: 'format_align_left' }, { value: 'center', icon: 'format_align_center' }, { value: 'right', icon: 'format_align_right' }, { value: 'justify', icon: 'format_align_justify' }], responsive: true },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'text-shadow', type: 'text-shadow', label: 'Text shadow' },
            { tab: 'style', target: 'styles', section: 'Typography', name: '-webkit-text-stroke', type: 'text-stroke', label: 'Text stroke' },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'mix-blend-mode', type: 'select', label: 'Blend mode', options: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion'] },
            { tab: 'style', target: 'styles', section: 'Link', name: 'link-color', type: 'color', label: 'Link color', states: true, property: 'color', part: 'link' },
            ...advancedControls,
            { tab: 'advanced', section: 'Custom attributes', name: 'cssId', type: 'text', label: 'CSS ID' },
            { tab: 'advanced', section: 'Custom attributes', name: 'cssClasses', type: 'text', label: 'CSS classes' },
        ],
        render: ({ domDocument }, node) => {
            const element = text(domDocument, node.settings.tag || 'h2', 'ink-el-heading', node.settings.text || '');
            if (node.settings.size) element.classList.add(`ink-size-${node.settings.size}`);
            if (node.settings.cssId) element.id = node.settings.cssId;
            if (node.settings.cssClasses) element.classList.add(...String(node.settings.cssClasses).trim().split(/\s+/));
            const link = node.settings.link && typeof node.settings.link === 'object' ? node.settings.link : node.settings.link ? { url: node.settings.link } : null;
            if (link && link.url) {
                const anchor = domDocument.createElement('a'); anchor.href = link.url; anchor.className = 'ink-el-heading-link';
                if (link.target) anchor.target = link.target;
                if (link.nofollow) anchor.setAttribute('rel', 'nofollow');
                anchor.textContent = node.settings.text || '';
                element.textContent = '';
                element.appendChild(anchor);
            }
            return element;
        },
    });
    registry.register({
        type: 'paragraph', title: 'Paragraph', icon: 'subject', category: 'Basic', inlineEditable: 'text',
        defaults: { settings: { text: 'Add your text here.' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Content', name: 'text', type: 'textarea', label: 'Text' },
            typographyControls,
            { tab: 'style', target: 'styles', section: 'Typography', name: 'color', type: 'color', label: 'Color' },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'text-align', type: 'choose', label: 'Alignment', options: [{ value: 'left', icon: 'format_align_left' }, { value: 'center', icon: 'format_align_center' }, { value: 'right', icon: 'format_align_right' }, { value: 'justify', icon: 'format_align_justify' }], responsive: true },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'text-shadow', type: 'text-shadow', label: 'Text shadow' },
            { tab: 'style', target: 'styles', section: 'Typography', name: '-webkit-text-stroke', type: 'text-stroke', label: 'Text stroke' },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'mix-blend-mode', type: 'select', label: 'Blend mode', options: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion'] },
            ...advancedControls,
        ],
        render: ({ domDocument }, node) => text(domDocument, 'p', 'ink-el-paragraph', node.settings.text || ''),
    });
    registry.register({
        type: 'button', title: 'Button', icon: 'smart_button', category: 'Basic', acceptsChildren: true, showEmptyView: false,
        acceptsChild: (_parent, child) => ['inline-text', 'icon', 'svg', 'image', 'frame'].includes(child.type),
        defaults: { settings: { text: 'Click here', url: '#', behavior: 'link', target: '_self', buttonType: 'button', icon: '', iconPosition: 'before', align: '' }, styles: { base: { width: 'fit-content', height: 'fit-content', color: '#ffffff', 'background-color': '#111827', padding: { top: 12, right: 24, bottom: 12, left: 24, unit: 'px' }, 'border-radius': { size: 8, unit: 'px' }, 'depth-size': { size: 0, unit: 'px' }, 'depth-color': 'transparent' } }, children: [] },
        selectors: { root: '&', surface: '.ink-el-button-surface', text: '.ink-el-button-text', icon: '.ink-el-button-icon' },
        styleMap: {
            'icon-gap': { property: '--ink-icon-gap', transform: (value) => `${Number(value.size) || 0}${value.unit || 'px'}` },
            'background-color': { part: 'surface', property: 'background-color' },
            padding: { part: 'surface' },
            'border-radius': { part: 'surface' },
            border: { part: 'surface' },
            // The colored, rounded part of a Button is its surface. A shadow belongs here,
            // rather than on the wrapper that also reserves optional physical depth.
            'box-shadow': { part: 'surface' },
            'depth-color': { property: 'background-color' },
            'depth-size': { property: '--ink-button-depth', transform: (value) => `${Number(value?.size ?? value) || 0}${value?.unit || 'px'}` },
            'outer-radius': { property: 'border-radius' },
        },
        controls: [
            { tab: 'content', section: 'Content', name: 'text', type: 'text', label: 'Text' },
            { tab: 'content', section: 'Content', name: 'behavior', type: 'choose', label: 'Behavior', options: [{ value: 'link', label: 'Link' }, { value: 'action', label: 'Action' }] },
            { tab: 'content', section: 'Content', name: 'url', type: 'url', label: 'Link' },
            { tab: 'content', section: 'Content', name: 'target', type: 'select', label: 'Target', options: [{ value: '_self', label: 'Same window' }, { value: '_blank', label: 'New window' }] },
            { tab: 'content', section: 'Content', name: 'buttonType', type: 'select', label: 'Action type', options: [{ value: 'button', label: 'Button' }, { value: 'submit', label: 'Submit' }, { value: 'reset', label: 'Reset' }], condition: { behavior: 'action' } },
            { tab: 'content', section: 'Layout', name: 'icon', type: 'text', label: 'Icon' },
            { tab: 'content', section: 'Layout', name: 'iconPosition', type: 'choose', label: 'Icon position', options: [{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }], condition: { icon: '__not_empty__' } },
            { tab: 'content', section: 'Layout', name: 'align', type: 'choose', label: 'Alignment', options: [{ value: '', icon: 'format_align_left', label: 'Left' }, { value: 'center', icon: 'format_align_center', label: 'Center' }, { value: 'right', icon: 'format_align_right', label: 'Right' }] },
            { tab: 'style', target: 'styles', section: 'Button', name: 'color', type: 'color', label: 'Text color', states: true, part: 'text' },
            { tab: 'style', target: 'styles', section: 'Surface', name: 'background-color', type: 'color', label: 'Fill', states: true, part: 'surface' },
            { tab: 'style', target: 'styles', section: 'Surface', name: 'border-radius', type: 'size', label: 'Corner radius', units: ['px', 'rem'], part: 'surface' },
            { tab: 'style', target: 'styles', section: 'Surface', name: 'padding', type: 'dimensions', label: 'Inner padding', units: ['px', 'em', 'rem'], responsive: true, part: 'surface' },
            { tab: 'style', target: 'styles', section: 'Surface', name: 'border', type: 'border', label: 'Border', states: true, part: 'surface' },
            { tab: 'style', target: 'styles', section: 'Depth', name: 'depth-color', type: 'color', label: 'Depth color', states: true },
            { tab: 'style', target: 'styles', section: 'Depth', name: 'depth-size', type: 'size', label: 'Depth', min: 0, max: 40, units: ['px', 'rem'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Depth', name: 'outer-radius', type: 'size', label: 'Outer radius', units: ['px', 'rem'] },
            { tab: 'style', target: 'styles', section: 'Button', name: 'box-shadow', type: 'box-shadow', label: 'Box shadow', states: true },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'icon-size', type: 'size', label: 'Icon size', units: ['px', 'em', 'rem'], property: 'font-size', part: 'icon' },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'icon-gap', type: 'size', label: 'Icon spacing', units: ['px', 'em', 'rem'] },
            { ...typographyControls, part: 'text' },
            ...advancedControls,
            { tab: 'advanced', section: 'Custom attributes', name: 'cssId', type: 'text', label: 'CSS ID' },
            { tab: 'advanced', section: 'Custom attributes', name: 'cssClasses', type: 'text', label: 'CSS classes' },
            { tab: 'advanced', section: 'Custom attributes', name: 'customAttributes', type: 'text', label: 'Custom attributes' },
        ],
        render: ({ domDocument }, node) => {
            const el = domDocument.createElement(node.settings.behavior === 'action' ? 'button' : 'a');
            el.className = 'ink-el-button';
            if (node.settings.align) el.classList.add(`is-align-${node.settings.align}`);
            if (el.tagName === 'A') { el.href = node.settings.url || '#'; el.target = node.settings.target || '_self'; }
            else el.type = ['button', 'submit', 'reset'].includes(node.settings.buttonType) ? node.settings.buttonType : 'button';
            const surface = domDocument.createElement('span'); surface.className = 'ink-el-button-surface'; surface.dataset.inkChildren = '';
            const label = domDocument.createElement('span'); label.className = 'ink-el-button-text'; label.textContent = node.settings.text || '';
            if (!(node.children || []).length && node.settings.icon) {
                const iconEl = domDocument.createElement('span'); iconEl.className = 'ink-el-button-icon'; iconEl.appendChild(renderIcon(domDocument, node.settings.icon));
                if (node.settings.iconPosition === 'after') { iconEl.classList.add('is-after'); surface.append(label, iconEl); }
                else surface.append(iconEl, label);
            } else if (!(node.children || []).length) surface.appendChild(label);
            el.appendChild(surface);
            return el;
        },
    });
    registry.register({
        type: 'image', title: 'Image', icon: 'image', category: 'Basic',
        defaults: { settings: { src: '', alt: '', link: '', caption: '', align: '' }, styles: { base: { 'max-width': '100%', height: 'auto' } } },
        selectors: { root: '&', figure: '.ink-el-image-figure', image: '.ink-el-image', link: '.ink-el-image-link', caption: 'figcaption' },
        styleMap: {
            'image-width': { part: 'image', property: 'width' },
            'image-height': { part: 'image', property: 'height' },
            'image-max-width': { part: 'image', property: 'max-width' },
            'image-max-height': { part: 'image', property: 'max-height' },
            'image-aspect-ratio': { part: 'image', property: 'aspect-ratio' },
        },
        controls: [
            { tab: 'content', section: 'Image', name: 'src', type: 'media', label: 'Image' },
            { tab: 'content', section: 'Image', name: 'alt', type: 'text', label: 'Alternative text' },
            { tab: 'content', section: 'Image', name: 'link', type: 'url', label: 'Link' },
            { tab: 'content', section: 'Image', name: 'caption', type: 'text', label: 'Caption' },
            { tab: 'content', section: 'Image', name: 'align', type: 'choose', label: 'Alignment', options: [{ value: '', icon: 'format_align_left', label: 'Left' }, { value: 'center', icon: 'format_align_center', label: 'Center' }, { value: 'right', icon: 'format_align_right', label: 'Right' }] },
            { tab: 'style', target: 'styles', section: 'Image', name: 'image-width', type: 'size', label: 'Image width', units: ['px', '%', 'vw'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Image', name: 'image-height', type: 'size', label: 'Image height', units: ['px', 'vh'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Image', name: 'image-max-width', type: 'size', label: 'Maximum width', units: ['px', '%', 'vw'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Image', name: 'image-max-height', type: 'size', label: 'Maximum height', units: ['px', 'vh'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Image', name: 'image-aspect-ratio', type: 'text', label: 'Aspect ratio' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'object-fit', type: 'select', label: 'Object fit', options: ['cover', 'contain', 'fill', 'none'], part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'object-position', type: 'select', label: 'Object position', options: ['center', 'top', 'bottom', 'left', 'right'], part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'filter', type: 'css-filters', label: 'CSS filters', states: true, part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'border', type: 'border', label: 'Border', states: true, part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'border-radius', type: 'dimensions', label: 'Radius', units: ['px', 'rem', '%'], responsive: true, part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'caption-color', type: 'color', label: 'Caption color', property: 'color', part: 'caption' },
            ...advancedControls,
            { tab: 'advanced', section: 'Custom attributes', name: 'cssId', type: 'text', label: 'CSS ID' },
            { tab: 'advanced', section: 'Custom attributes', name: 'cssClasses', type: 'text', label: 'CSS classes' },
        ],
        render: ({ domDocument }, node) => {
            const image = domDocument.createElement('img'); image.className = 'ink-el-image'; image.src = node.settings.src || ''; image.alt = node.settings.alt || '';
            if (node.settings.cssId) image.id = node.settings.cssId;
            if (node.settings.cssClasses) image.classList.add(...String(node.settings.cssClasses).trim().split(/\s+/));
            const link = node.settings.link && typeof node.settings.link === 'object' ? node.settings.link.url : node.settings.link;
            const wrapper = domDocument.createElement('figure'); wrapper.className = 'ink-el-image-figure';
            if (link) {
                const anchor = domDocument.createElement('a'); anchor.href = link; anchor.className = 'ink-el-image-link'; anchor.appendChild(image); wrapper.appendChild(anchor);
            } else {
                wrapper.appendChild(image);
            }
            if (node.settings.align) { wrapper.classList.add(`is-align-${node.settings.align}`); image.classList.add(`is-align-${node.settings.align}`); }
            if (node.settings.caption) wrapper.appendChild(Object.assign(domDocument.createElement('figcaption'), { textContent: node.settings.caption }));
            return wrapper;
        },
    });
    registry.register({
        type: 'divider', title: 'Divider', icon: 'horizontal_rule', category: 'Basic',
        defaults: { settings: { weight: 1, align: '' }, styles: { base: { border: '0', 'border-top': '1px solid #7a7a7a', width: '100%' } } },
        controls: [
            { tab: 'content', section: 'Divider', name: 'align', type: 'choose', label: 'Alignment', options: [{ value: '', icon: 'format_align_left', label: 'Left' }, { value: 'center', icon: 'format_align_center', label: 'Center' }, { value: 'right', icon: 'format_align_right', label: 'Right' }] },
            { tab: 'style', target: 'styles', section: 'Divider', name: 'border-top', type: 'border', label: 'Color / weight' },
            { tab: 'style', target: 'styles', section: 'Divider', name: 'width', type: 'size', label: 'Width', units: ['px', '%'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Divider', name: 'margin', type: 'dimensions', label: 'Gap', units: ['px', 'rem', 'em'], responsive: true },
            ...advancedControls,
        ],
        render: ({ domDocument }, node) => { const el = domDocument.createElement('hr'); el.className = 'ink-el-divider'; if (node.settings.align) el.classList.add(`is-align-${node.settings.align}`); if (node.settings.weight) el.style.borderTopWidth = `${node.settings.weight}px`; return el; },
    });
    registry.register({
        type: 'spacer', title: 'Spacer', icon: 'height', category: 'Basic',
        defaults: { settings: {}, styles: { base: { height: { size: 50, unit: 'px' } } } },
        controls: [{ tab: 'content', target: 'styles', section: 'Spacer', name: 'height', type: 'size', label: 'Space', units: ['px', 'vh'], responsive: true }],
        render: ({ domDocument }) => { const el = domDocument.createElement('div'); el.className = 'ink-el-spacer'; return el; },
    });
    return registry;
}
