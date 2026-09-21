// Shared by Preview and exported pages. Motion remains ordinary editable element data.
export const SCROLL_MOTION_RUNTIME = String.raw`(function () {
    if (window.__inkScrollMotion) return;
    window.__inkScrollMotion = true;
    const records = new Map();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let scheduled = false;
    const inactive = () => reduced.matches || document.body.classList.contains('ink-builder-design');
    const allowed = new Set(['offset', 'transform', 'opacity', 'filter', 'clip-path', 'background-color', 'color']);
    function update() {
        scheduled = false;
        for (const [element, record] of records) {
            if (!element.isConnected || inactive()) {
                record.animation.cancel(); records.delete(element); continue;
            }
            // The parent is the stable scroll section: animating the target's transform must
            // never alter its own scroll measurement (which causes feedback and jitter).
            const rect = element.parentElement.getBoundingClientRect();
            if (record.trigger === 'scroll') {
                const progress = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
                record.animation.currentTime = progress * record.duration;
            } else if (!record.started && rect.top < innerHeight && rect.bottom > 0) {
                record.started = true; record.animation.play();
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
                records.set(element, { animation, duration, trigger: motion.trigger, started: false });
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
