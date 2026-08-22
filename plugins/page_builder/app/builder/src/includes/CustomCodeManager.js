// Custom CSS/JS is a first-class builder capability. The builder owns the page's custom code
// (the Code tab) and the design-kit vocabulary, injecting both into the canvas + panel so
// designs render with their own styling — no global design-system stylesheet required, and no
// dependency on an external stylesheet load (the vocabulary is injected INLINE, so it always
// applies: no cache staleness, no link-timing races).
//
// Builder pattern (data-first): element data is the single source of truth; HTML is
// re-derived from it on every render, and CSS is layered — the base design-kit vocabulary
// (the .cp-* hooks the element templates emit + their keyframes) plus the page's custom CSS
// (Code tab / Copilot design) that refines it. The vocabulary is ONE canonical file
// (themes/standard/1_column_layout/ink-design-kit.css), imported here at build time
// (webpack asset/source) and mirrored at public/page_builder_theme/ink-design-kit.css for
// published pages — the two can never drift because both come from the same file.

import DESIGN_KIT_CSS from '../../../../themes/standard/1_column_layout/ink-design-kit.css';

class CustomCodeManager {
    constructor(builder, options = {}) {
        this.builder = builder;
        this.css = options.css || '';
        this.js = options.js || '';
    }

    getCss() {
        return this.css;
    }

    getJs() {
        return this.js;
    }

    // The full design-kit vocabulary (the canonical file, imported at build time).
    getEffectCss() {
        return DESIGN_KIT_CSS;
    }

    setCss(value) {
        this.css = value;
    }

    setJs(value) {
        this.js = value;
    }

    // Inject the design vocabulary into a document as an INLINE <style> (no link dependency, so
    // it always applies — no cache staleness or load-timing races). Called for the builder panel
    // (design-kit thumbnails) and the canvas iframe (the design).
    injectEffectStyles(doc) {
        if (!doc || !doc.head) return;
        let fxEl = doc.getElementById('pb-effect-styles');
        if (!fxEl) { fxEl = doc.createElement('style'); fxEl.id = 'pb-effect-styles'; doc.head.appendChild(fxEl); }
        if (fxEl.textContent !== DESIGN_KIT_CSS) fxEl.textContent = DESIGN_KIT_CSS;
    }

    inject(doc) {
        doc = doc || (this.builder.iframeDoc || (this.builder.iframe && this.builder.iframe.contentDocument));
        if (!doc || !doc.head || !doc.body) return;

        this.injectEffectStyles(doc);

        // Page custom CSS.
        let cssEl = doc.getElementById('pb-custom-css');
        if (this.css) {
            if (!cssEl) { cssEl = doc.createElement('style'); cssEl.id = 'pb-custom-css'; doc.head.appendChild(cssEl); }
            cssEl.textContent = this.css;
        } else if (cssEl) {
            cssEl.remove();
        }

        // Page custom JS.
        const old = doc.getElementById('pb-custom-js');
        if (old) old.remove();
        if (this.js) {
            const script = doc.createElement('script');
            script.id = 'pb-custom-js';
            script.textContent = 'try {\n' + this.js + '\n} catch (e) { console.error("Custom JS error:", e) }';
            doc.body.appendChild(script);
        }
    }

    // The layout's live-edit hook: update the working copy and re-inject into the canvas.
    update(css, js) {
        this.setCss(css);
        this.setJs(js);
        this.inject();
    }
}

export default CustomCodeManager;
