// Shared by Preview and exported pages. Motion remains ordinary editable element data.
//
// Two kinds of scroll motion exist and both live here:
//   1. A single layer whose own motion triggers on `scroll` -- it scrubs against its parent.
//   2. A motion GROUP (`[data-ink-motion-group]`) whose children scrub against one shared
//      reference, so a pinned section advances every layer off the *same* progress value.
// The group's reference is the group element itself, or its parent when the group asked for
// `scrub.reference = "parent"`. Group members never measure their own transform, which is what
// keeps a scrubbed transform from feeding back into the scroll position.
export const SCROLL_MOTION_RUNTIME = String.raw`(function () {
    if (window.__inkScrollMotion) return;
    window.__inkScrollMotion = true;
    const records = new Map();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let scheduled = false;
    const inactive = () => reduced.matches || document.body.classList.contains('ink-builder-design');
    const allowed = new Set(['offset', 'transform', 'opacity', 'filter', 'clip-path', 'background-color', 'color']);
    const clamp01 = (value) => Math.max(0, Math.min(1, value));
    function groupOf(element) {
        const owner = element.closest('[data-ink-motion-group]');
        if (!owner) return null;
        try {
            const group = JSON.parse(owner.getAttribute('data-ink-motion-group') || 'null');
            return group && group.trigger === 'scroll' ? { owner, group } : null;
        } catch (error) { return null; }
    }
    function referenceOf(element) {
        const scoped = groupOf(element);
        if (!scoped) return element.parentElement;
        return scoped.group.scrub && scoped.group.scrub.reference === 'parent' ? (scoped.owner.parentElement || scoped.owner) : scoped.owner;
    }
    function progressFor(rect, motion) {
        let progress = clamp01((innerHeight - rect.top) / (innerHeight + rect.height));
        const scrub = motion.scrub || (motion.scrubWindow);
        if (scrub && typeof scrub === 'object') {
            const start = Number(scrub.start) || 0;
            const end = Number.isFinite(Number(scrub.end)) ? Number(scrub.end) : 1;
            progress = clamp01((progress - start) / Math.max(0.0001, end - start));
        }
        return progress;
    }
    function update() {
        scheduled = false;
        const frameRects = new Map();
        for (const [element, record] of records) {
            if (!element.isConnected || inactive()) {
                record.animation.cancel(); records.delete(element); continue;
            }
            if (record.trigger === 'scroll') {
                const reference = record.reference || element.parentElement;
                let rect = frameRects.get(reference);
                // The reference is the stable scroll section: animating the target's transform must
                // never alter its own scroll measurement (which causes feedback and jitter). One
                // measurement per reference per frame is shared by every member of a group.
                if (!rect) { rect = reference.getBoundingClientRect(); frameRects.set(reference, rect); }
                record.animation.currentTime = progressFor(rect, record.motion) * record.duration;
            } else {
                const rect = element.parentElement.getBoundingClientRect();
                if (!record.started && rect.top < innerHeight && rect.bottom > 0) {
                    record.started = true; record.animation.play();
                }
            }
        }
    }
    function schedule() {
        if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
    }
    function scan() {
        if (!inactive()) document.querySelectorAll('[data-ink-scroll-motion]').forEach((element) => {
            if (records.has(element)) return;
            try {
                const motion = JSON.parse(element.getAttribute('data-ink-scroll-motion'));
                if (!['scroll', 'enter'].includes(motion.trigger) || !Array.isArray(motion.keyframes) || motion.keyframes.length < 2) return;
                const frames = motion.keyframes.map((frame) => Object.fromEntries(Object.entries(frame).filter(([key]) => allowed.has(key))));
                const duration = Math.max(1, Number(motion.duration) || 800);
                const animation = element.animate(frames, {
                    duration, fill: 'both', iterations: 1,
                    easing: motion.easing || 'linear',
                    delay: motion.trigger === 'enter' ? Number(motion.delay) || 0 : 0,
                });
                animation.pause();
                records.set(element, {
                    animation, duration, motion, trigger: motion.trigger,
                    reference: motion.trigger === 'scroll' ? referenceOf(element) : null,
                    started: false,
                });
            } catch (error) { console.warn('Ink motion could not start', error.message); }
        });
        schedule();
    }
    addEventListener('scroll', schedule, { passive: true, capture: true });
    addEventListener('resize', schedule, { passive: true });
    reduced.addEventListener('change', scan);
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(scan).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    scan();
})();`;
