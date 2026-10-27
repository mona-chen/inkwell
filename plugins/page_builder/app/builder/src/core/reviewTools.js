import { toJpeg } from 'html-to-image';

// Visual review for the Copilot: the chat model composes the page as data, but data cannot tell
// it what the page looks like. When the site names an image-capable review model (Settings →
// Copilot), this tool snapshots the LIVE canvas — the whole page or one layer, at a chosen
// device width — and the server relays the JPEG to that reviewer for a product-design critique.
//
// Two rules keep the loop honest and cheap:
//   1. The tool is only advertised while an endpoint is configured, so a site is never offered
//      a review it cannot serve (same contract as the media tools).
//   2. Captures are budgeted per request. A screenshot costs a real provider round-trip, and a
//      model left unchecked will review every section twice; four captures force it to spend
//      them on the hero and the riskiest sections, then judge the rest with audit_design.

const MAX_REVIEWS_PER_REQUEST = 4;
// The server refuses snapshots above 3 MB; the data: prefix and base64 expansion leave less
// room than that for pixels, so captures retry smaller instead of arriving to be refused.
const MAX_SNAPSHOT_BYTES = 2_400_000;
const MAX_SNAPSHOT_WIDTH = 1400;

const config = () => (typeof window !== 'undefined' && window.inkCopilot) || {};
export const visualReviewUrl = () => config().visualReviewUrl || null;

const csrfToken = () => (typeof document === 'undefined' ? null : document.querySelector('meta[name="csrf-token"]')?.content);

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

// Cross-origin stylesheets (the canvas's Google Fonts link) are opaque to cssRules, so the
// capture library cannot inline their fonts on its own first pass. Fetching the sheet text
// once — those endpoints allow CORS — and handing it over keeps the snapshot in the page's
// real typography, which is half of what a design review judges.
let embeddedFonts = { key: null, css: null };
const fontEmbedCss = async (doc) => {
    const hrefs = [...doc.querySelectorAll('link[rel="stylesheet"][href]')].map((link) => link.href)
        .filter((href) => { try { return new URL(href).origin !== window.location.origin; } catch (_) { return false; } });
    const key = hrefs.join('|');
    if (embeddedFonts.key === key) return embeddedFonts.css;
    const parts = await Promise.all(hrefs.map(async (href) => {
        try { const response = await fetch(href); return response.ok ? await response.text() : ''; } catch (_) { return ''; }
    }));
    embeddedFonts = { key, css: parts.filter(Boolean).join('\n') || null };
    return embeddedFonts.css;
};

export const REVIEW_TOOL = {
    name: 'review_design',
    description: 'Capture a JPEG snapshot of the live canvas — the full page, or one layer by path/id — at desktop, tablet or mobile width, and get a product-design critique of the actual pixels: composition, hierarchy, typography, spacing, contrast, imagery, clipping and responsive fit. Use it after building or restyling a section to see the page the way a visitor would, then fix the highest-impact findings with editing tools. Budget: four captures per request, so spend them on the hero and the riskiest sections. This judges appearance only; audit_design remains the structural check.',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Dot path from read_design. Omit path and id to review the whole page.' },
            id: { type: 'string', description: 'Layer id from read_design or the editor context.' },
            device: { type: 'string', enum: ['desktop', 'tablet', 'mobile'], description: 'Canvas width for the capture. Defaults to the current device.' },
            brief: { type: 'string', description: 'What this capture should be judged against — the section’s job, the requested style, the concern to check.' },
        },
    },
};

export function createReviewTools(runtime, builder, resolve) {
    let reviewsUsed = 0;

    const available = () => Boolean(visualReviewUrl());
    const resetReviewBudget = () => { reviewsUsed = 0; };

    // Map a layer to its rendered node: the renderer's instance record first, the id marker
    // the canvas emits as a fallback. The full page is the canvas root itself.
    const targetElement = ({ path, id } = {}) => {
        if (!path && !id) return { element: builder.canvasRoot, label: 'full page' };
        const found = resolve(path || id);
        if (!found) throw new Error('Layer not found; read_design for current paths and ids.');
        const element = runtime.canvas.instances.get(found.node.id)?.element
            || builder.canvasRoot?.querySelector(`[data-ink-element-id="${CSS.escape(found.node.id)}"]`);
        if (!element) throw new Error('That layer is not rendered right now; review the full page instead.');
        const text = String(found.node.settings?.text || found.node.settings?.title || found.node.settings?.label || '').replace(/<[^>]+>/g, '').slice(0, 48);
        return { element, label: `${found.node.type}${text ? ` “${text}”` : ''} [${found.path}]` };
    };

    // The shot should look like the published page, not the editor: selection rings come off,
    // editor-only overlays (drop lines, snap guides, gesture tooltips — everything that is not
    // the canvas root or a style/script node) hide, and the editor-only stylesheet is paused
    // exactly the way publish strips it. Everything is restored afterwards.
    const prepareCapture = () => {
        const doc = builder.iframeDoc;
        const marked = [...doc.querySelectorAll('.ink-is-selected')];
        marked.forEach((element) => element.classList.remove('ink-is-selected'));
        const hidden = [];
        [...doc.body.children].forEach((child) => {
            if (child === builder.canvasRoot || ['STYLE', 'SCRIPT', 'LINK', 'TEMPLATE'].includes(child.tagName)) return;
            hidden.push([child, child.style.display]);
            child.style.display = 'none';
        });
        const editorStyles = doc.querySelector('#ink-editor-canvas-styles');
        let pausedSheet = null;
        try { if (editorStyles?.sheet && !editorStyles.sheet.disabled) { pausedSheet = editorStyles.sheet; pausedSheet.disabled = true; } } catch (_) { /* a paused sheet is cosmetic only */ }
        return () => {
            marked.forEach((element) => element.classList.add('ink-is-selected'));
            hidden.forEach(([child, display]) => { child.style.display = display; });
            try { if (pausedSheet) pausedSheet.disabled = false; } catch (_) { /* restored on the next render regardless */ }
        };
    };

    const capture = async (element) => {
        const width = element.getBoundingClientRect().width || builder.iframe?.clientWidth || 1200;
        const baseRatio = Math.max(0.5, Math.min(2, MAX_SNAPSHOT_WIDTH / Math.max(1, width)));
        const fonts = await fontEmbedCss(builder.iframeDoc);
        const attempts = [[baseRatio, 0.78], [baseRatio * 0.8, 0.66], [baseRatio * 0.62, 0.55]];
        let lastError = null;
        for (const [pixelRatio, quality] of attempts) {
            try {
                const snapshot = await toJpeg(element, { pixelRatio, quality, skipAutoScale: true, style: { margin: '0' }, ...(fonts ? { fontEmbedCSS: fonts } : {}) });
                if (snapshot.length <= MAX_SNAPSHOT_BYTES) return snapshot;
            } catch (error) { lastError = error; }
        }
        throw lastError || new Error('The snapshot stayed above the review size limit; review one section instead of the full page.');
    };

    const assess = async ({ path, id, device, brief } = {}) => {
        if (!available()) return { ok: false, error: 'Visual review is not configured for this site, so no screenshot was taken. Judge the structure with audit_design, and never claim you saw the page.' };
        if (reviewsUsed >= MAX_REVIEWS_PER_REQUEST) return { ok: false, error: `The visual review budget for this request is spent (${MAX_REVIEWS_PER_REQUEST} captures). Judge what remains with audit_design and your own standards.` };
        reviewsUsed += 1;

        const responsive = runtime.responsive;
        const previousDevice = responsive?.device;
        const wanted = ['desktop', 'tablet', 'mobile'].includes(device) ? device : previousDevice;
        const restoreDevice = async () => {
            if (responsive && previousDevice && wanted && wanted !== previousDevice) { responsive.setDevice(previousDevice); await nextFrame(); }
        };
        try {
            if (responsive && wanted && wanted !== previousDevice) { responsive.setDevice(wanted); await nextFrame(); }
            const { element, label } = targetElement({ path, id });
            const cleanup = prepareCapture();
            let snapshot;
            try {
                await nextFrame();
                snapshot = await capture(element);
            } finally { cleanup(); }
            // Measure while the capture device is still on the canvas; restoring first would
            // label a mobile screenshot with the desktop width it no longer has.
            const width = Math.round(element.getBoundingClientRect().width);
            await restoreDevice();

            const captureLabel = `${wanted || 'desktop'} · ${width}px · ${label}`;
            const response = await fetch(visualReviewUrl(), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken() },
                body: JSON.stringify({ image: snapshot, brief: String(brief || '').slice(0, 1500), viewport: captureLabel }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.error || payload.ok === false) throw new Error(payload.error || `Visual review failed (${response.status}).`);
            return {
                ok: true,
                visuallyReviewed: true,
                capture: captureLabel,
                reviewsRemaining: MAX_REVIEWS_PER_REQUEST - reviewsUsed,
                critique: payload.critique,
                guidance: 'This is the rendered page, judged from pixels. Fix the highest-impact findings with editing tools (set_styles, update_element, css_edit), then review again only if the edits were sweeping. Do not report the critique to the user verbatim; fold the fixes into your summary.',
            };
        } catch (error) {
            await restoreDevice();
            return { ok: false, error: error.message };
        }
    };

    return { tool: REVIEW_TOOL, assess, available, resetReviewBudget };
}
