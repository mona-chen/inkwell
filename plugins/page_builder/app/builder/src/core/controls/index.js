import { SHADER_PRESETS, CUSTOM_SHADER_EXAMPLE, normalizeShader, validateCustomShader } from '../shaderPresets.js';
// Standalone control renderers — independent implementations with a uniform contract:
//   render(panel, control, node, value, row) => row
// PanelManager stays thin: renderControl() delegates here via the ControlRegistry.
// Each renderer uses only the panel context (setValue/currentValue/renderControl/
// runtime) — no private PanelManager state.

import { pickMedia, uploadMedia } from '../MediaPicker.js';
import { RichTextAdapter } from '../RichTextAdapter.js';
import { iconNames, iconCount, iconValue, resolveIcon, renderIcon, libraryTitle } from '../icons.js';
import { availableFonts } from '../fonts.js';
import { ELEMENTOR_SHAPES } from '../elementorShapes.js';
import {
    INTERACTION_ACTIONS, INTERACTION_ACTION_LABELS, INTERACTION_EVENTS, INTERACTION_EVENT_LABELS,
    INTERACTION_TARGETS, INTERACTION_TARGET_LABELS, normalizeInteractions, normalizeStateList, normalizeStateName,
} from '../states.js';
import {
    MOTION_GROUP_KINDS, MOTION_GROUP_KIND_LABELS, MOTION_GROUP_TRIGGERS, MOTION_GROUP_TRIGGER_LABELS,
    describeMotionGroup, motionGroupItems, normalizeMotionGroup,
} from '../motionGroups.js';
import { clampValue, parseValueInput, scrubDelta, stepValue } from '../valueInput.js';
import { EASING_PRESETS, SPRING_DEFAULTS, bezierPath, easingBox, easingCss, parseEasing, springSettleMs, springToBezier, validateEasing } from '../easing.js';
import { TRACK_UNITS, parseTracks, serializeTracks, resizeTracks, tracksFromCount, trackText } from '../gridTracks.js';

const labelFor = (option) => typeof option === 'object' ? option.label : String(option).replace(/-/g, ' ');
const valueFor = (option) => typeof option === 'object' ? option.value : option;

// Native inputs in custom controls must commit like the generic PanelManager inputs.
// Relying only on `change` makes typed values look accepted while Enter does nothing,
// which is especially damaging for dimensions, spacing, and URLs.
const commitOnFinish = (input, commit) => {
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || input.tagName === 'TEXTAREA') return;
        event.preventDefault();
        commit();
        input.blur();
    });
};

const switchControl = ({ checked = false, onLabel = 'Yes', offLabel = 'No', ariaLabel = '' } = {}) => {
    const wrapper = document.createElement('span'); wrapper.className = 'ink-v2-switch';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = checked;
    if (ariaLabel) checkbox.setAttribute('aria-label', ariaLabel);
    const track = document.createElement('span'); track.className = 'ink-v2-switch-track'; track.dataset.on = onLabel; track.dataset.off = offLabel; track.setAttribute('aria-hidden', 'true');
    track.addEventListener('click', () => checkbox.click());
    wrapper.append(checkbox, track);
    return { wrapper, checkbox };
};

/* ------------------------------------------------------------------ *
 * Shared field primitives: numeric scrubbing, easing curves, grid tracks
 * ------------------------------------------------------------------ */

// A numeric field with the affordances a design tool is expected to have: drag the control label to
// scrub, type arithmetic ("12*2", "100% - 20"), step with the arrow keys (Shift = coarse, Alt =
// fine), and read a reason when a value is clamped instead of watching it silently change.
//
// The field never touches the store itself: `onLive` previews inside one undo step, `onCommit`
// closes that step, and `onSet` writes a discrete change. That keeps the panel's history rules in
// PanelManager, where they belong.
export function numericField({ value, units = null, defaultUnit = 'px', min = null, max = null, step = 1, ariaLabel = 'Value', placeholder = '', handle = null, onLive = null, onCommit = null, onSet = null } = {}) {
    const unitList = Array.isArray(units) && units.length ? [...units] : null;
    const readSize = (source) => (source && typeof source === 'object' ? source.size : source);
    const readUnit = (source) => (source && typeof source === 'object' ? source.unit : null);
    let committed = { size: readSize(value) ?? '', unit: readUnit(value) || defaultUnit };
    const host = document.createElement('div'); host.className = 'ink-v2-number-field';
    const input = document.createElement('input'); input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false;
    input.inputMode = 'decimal'; input.setAttribute('aria-label', ariaLabel);
    if (placeholder) input.placeholder = placeholder;
    input.value = committed.size === '' || committed.size === null || committed.size === undefined ? '' : String(committed.size);
    const unit = unitList ? document.createElement('select') : null;
    if (unit) { unit.className = 'ink-v2-unit'; unit.setAttribute('aria-label', `${ariaLabel} unit`); unitList.forEach((name) => unit.add(new Option(name, name))); unit.value = committed.unit; }
    const note = document.createElement('small'); note.className = 'ink-v2-field-note'; note.hidden = true;
    host.append(input); if (unit) host.append(unit); host.append(note);

    const numeric = () => { const size = Number(committed.size); return Number.isFinite(size) ? size : 0; };
    const compose = (size) => (unitList ? { size, unit: unit && unit.value ? unit.value : defaultUnit } : size);
    const apply = (next, { live = false } = {}) => {
        if (live && onLive) { onLive(next); return; }
        if (onSet) { onSet(next); return; }
        if (onCommit) onCommit(next);
    };
    let noteTimer = null;
    const explain = (message, { autoHide = true } = {}) => {
        note.textContent = message; note.hidden = !message;
        if (noteTimer) clearTimeout(noteTimer);
        if (message && autoHide) noteTimer = setTimeout(() => { note.hidden = true; }, 4000);
    };
    const show = (size) => { input.value = size === '' || size === null || size === undefined ? '' : String(size); };
    const revert = () => { show(committed.size); if (unit) unit.value = committed.unit; input.removeAttribute('aria-invalid'); explain(''); };

    const commit = () => {
        const text = input.value.trim();
        if (!text) {
            committed = { size: '', unit: unit ? unit.value : defaultUnit };
            input.removeAttribute('aria-invalid'); explain('');
            if (onSet) onSet(''); else if (onCommit) onCommit('');
            return;
        }
        const parsed = parseValueInput(text, { current: numeric(), units: unitList || [defaultUnit], defaultUnit });
        if (!parsed || typeof parsed.size === 'string') {
            input.setAttribute('aria-invalid', 'true');
            explain('Try a number, a unit like 24px, or arithmetic like 100% - 20.', { autoHide: false });
            return;
        }
        const bounded = clampValue(parsed.size, { min, max });
        input.removeAttribute('aria-invalid');
        if (unit && parsed.unit && Array.from(unit.options).some((option) => option.value === parsed.unit)) unit.value = parsed.unit;
        committed = { size: bounded.value, unit: unit ? unit.value : defaultUnit };
        show(bounded.value);
        explain(bounded.clamped ? bounded.reason : '');
        const next = compose(bounded.value);
        if (onSet) onSet(next); else if (onCommit) onCommit(next);
    };

    input.addEventListener('change', commit);
    input.addEventListener('blur', () => { if (input.hasAttribute('aria-invalid')) revert(); else commit(); });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); commit(); input.blur(); return; }
        if (event.key === 'Escape') { event.preventDefault(); revert(); input.blur(); return; }
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const next = stepValue(numeric(), { step, direction: event.key === 'ArrowUp' ? 1 : -1, shift: event.shiftKey, alt: event.altKey, min, max });
        committed = { size: next, unit: unit ? unit.value : defaultUnit };
        show(next);
        const composed = compose(next);
        if (onLive) { onLive(composed); if (onCommit) onCommit(composed); } else if (onSet) onSet(composed);
    });
    if (unit) unit.addEventListener('change', commit);

    // Scrubbing: dragging the control's own label changes the value, which is the gesture authors
    // expect from a number in a design tool. A click without movement changes nothing.
    if (handle) {
        handle.classList.add('is-scrubbable');
        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            const startX = event.clientX;
            const startValue = numeric();
            let moved = false;
            const composeFrom = (clientX, modifiers) => scrubDelta(startValue, startX, clientX, { step, shift: modifiers.shift, alt: modifiers.alt, min, max });
            const move = (moveEvent) => {
                if (Math.abs(moveEvent.clientX - startX) > 2) moved = true;
                if (!moved) return;
                const next = composeFrom(moveEvent.clientX, { shift: moveEvent.shiftKey, alt: moveEvent.altKey });
                committed = { size: next, unit: unit ? unit.value : defaultUnit };
                show(next);
                if (onLive) onLive(compose(next));
            };
            const up = (upEvent) => {
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', up);
                document.body.classList.remove('ink-is-scrubbing');
                if (!moved) return;
                const next = composeFrom(upEvent.clientX, { shift: upEvent.shiftKey, alt: upEvent.altKey });
                committed = { size: next, unit: unit ? unit.value : defaultUnit };
                show(next);
                if (onCommit) onCommit(compose(next)); else if (onSet) onSet(compose(next));
            };
            document.body.classList.add('ink-is-scrubbing');
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
        });
    }
    return { element: host, input, unit, note, explain, setValue: (next) => { committed = { size: readSize(next) ?? '', unit: readUnit(next) || defaultUnit }; show(committed.size); if (unit) unit.value = committed.unit; } };
}

// The easing editor: a preset list, a draggable bezier curve, and a spring tab that converts
// physical parameters into a legal cubic-bezier while keeping the parameters beside it, so the
// sliders come back where the author left them and the stylesheet only ever sees valid CSS.
export function easingEditor({ value, spring = null, onChange, onDuration = null, ariaLabel = 'Easing' } = {}) {
    const parsed = parseEasing(value);
    let points = [...parsed.points];
    let springState = spring && typeof spring === 'object' ? { ...SPRING_DEFAULTS, ...spring } : null;

    const host = document.createElement('div'); host.className = 'ink-v2-easing';
    const head = document.createElement('div'); head.className = 'ink-v2-easing-head';
    const preset = document.createElement('select'); preset.setAttribute('aria-label', ariaLabel);
    EASING_PRESETS.forEach((entry) => preset.add(new Option(entry.label, entry.id)));
    preset.add(new Option('Custom curve', 'custom'));
    const matching = () => EASING_PRESETS.find((entry) => entry.points.every((point, index) => Math.abs(point - points[index]) < 0.005));
    preset.value = matching()?.id || 'custom';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'ink-v2-easing-toggle'; toggle.textContent = 'Edit curve'; toggle.setAttribute('aria-expanded', 'false');
    head.append(preset, toggle);

    const body = document.createElement('div'); body.className = 'ink-v2-easing-body'; body.hidden = true;
    const tabs = document.createElement('div'); tabs.className = 'ink-v2-easing-tabs'; tabs.setAttribute('role', 'tablist');
    const curveTab = document.createElement('button'); curveTab.type = 'button'; curveTab.textContent = 'Curve'; curveTab.setAttribute('role', 'tab');
    const springTab = document.createElement('button'); springTab.type = 'button'; springTab.textContent = 'Spring'; springTab.setAttribute('role', 'tab');
    tabs.append(curveTab, springTab);
    // Designer words first: the four shapes an author reaches for, plus the drawable curve. They map
    // onto the same curves as the preset list above, so nothing here is a new vocabulary.
    const EASING_CHIPS = [['Smooth', 'ease-in-out'], ['Snappy', 'expo-out'], ['Spring', 'back-out'], ['Bounce', 'anticipate']];
    const chips = document.createElement('div'); chips.className = 'ink-v2-easing-chips';
    const curveChips = EASING_CHIPS.map(([label, id]) => {
        const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'ink-v2-easing-chip'; chip.textContent = label;
        chip.dataset.easing = id; chip.title = EASING_PRESETS.find((entry) => entry.id === id)?.label || label;
        chip.addEventListener('click', () => {
            const entry = EASING_PRESETS.find((candidate) => candidate.id === id);
            if (!entry) return;
            points = [...entry.points]; springState = null; selectEasingTab('curve'); draw(); emit();
        });
        chips.appendChild(chip);
        return chip;
    });
    const customChip = document.createElement('button'); customChip.type = 'button'; customChip.className = 'ink-v2-easing-chip'; customChip.textContent = 'Custom'; customChip.title = 'Drag the handles to shape the curve';
    customChip.addEventListener('click', () => selectEasingTab('curve'));
    chips.appendChild(customChip);

    const svgNamespace = 'http://www.w3.org/2000/svg';
    const box = easingBox({ width: 128, height: 128, padding: 14 });
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`); svg.setAttribute('class', 'ink-v2-easing-curve'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Easing curve editor');
    const grid = document.createElementNS(svgNamespace, 'path');
    grid.setAttribute('class', 'ink-v2-easing-grid');
    grid.setAttribute('d', `M${box.x(0)} ${box.y(0)} L${box.x(1)} ${box.y(1)} M${box.x(0)} ${box.y(1)} L${box.x(1)} ${box.y(1)}`);
    const curve = document.createElementNS(svgNamespace, 'path'); curve.setAttribute('class', 'ink-v2-easing-path');
    const stemOne = document.createElementNS(svgNamespace, 'line'); stemOne.setAttribute('class', 'ink-v2-easing-stem');
    const stemTwo = document.createElementNS(svgNamespace, 'line'); stemTwo.setAttribute('class', 'ink-v2-easing-stem');
    const handleOne = document.createElementNS(svgNamespace, 'circle'); handleOne.setAttribute('class', 'ink-v2-easing-handle'); handleOne.setAttribute('r', '7'); handleOne.dataset.handle = 'first';
    const handleTwo = document.createElementNS(svgNamespace, 'circle'); handleTwo.setAttribute('class', 'ink-v2-easing-handle'); handleTwo.setAttribute('r', '7'); handleTwo.dataset.handle = 'second';
    const readout = document.createElementNS(svgNamespace, 'text'); readout.setAttribute('class', 'ink-v2-easing-readout'); readout.setAttribute('x', box.x(0)); readout.setAttribute('y', box.height - 3);
    svg.append(grid, stemOne, stemTwo, curve, handleOne, handleTwo, readout);

    const draw = () => {
        const drawn = bezierPath(points, box);
        curve.setAttribute('d', drawn.path);
        const [x1, y1, x2, y2] = points;
        stemOne.setAttribute('x1', box.x(0)); stemOne.setAttribute('y1', box.y(0)); stemOne.setAttribute('x2', box.x(x1)); stemOne.setAttribute('y2', box.y(y1));
        stemTwo.setAttribute('x1', box.x(1)); stemTwo.setAttribute('y1', box.y(1)); stemTwo.setAttribute('x2', box.x(x2)); stemTwo.setAttribute('y2', box.y(y2));
        handleOne.setAttribute('cx', box.x(x1)); handleOne.setAttribute('cy', box.y(y1));
        handleTwo.setAttribute('cx', box.x(x2)); handleTwo.setAttribute('cy', box.y(y2));
        readout.textContent = easingCss(points);
        const matched = matching()?.id || 'custom';
        preset.value = matched;
        curveChips.forEach((chip) => chip.classList.toggle('is-active', !springState && chip.dataset.easing === matched));
    };

    const emit = () => onChange({ easing: easingCss(points), spring: springState });
    const dragHandle = (circle, index) => {
        circle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            circle.setPointerCapture?.(event.pointerId);
            const rect = svg.getBoundingClientRect();
            const scaleX = box.width / rect.width; const scaleY = box.height / rect.height;
            const move = (moveEvent) => {
                const px = (moveEvent.clientX - rect.left) * scaleX;
                const py = (moveEvent.clientY - rect.top) * scaleY;
                points[index] = box.unx(px);
                points[index + 1] = box.uny(py);
                draw();
            };
            const up = () => {
                circle.removeEventListener('pointermove', move);
                circle.removeEventListener('pointerup', up);
                document.body.classList.remove('ink-is-scrubbing');
                springState = null;
                emit();
            };
            document.body.classList.add('ink-is-scrubbing');
            circle.addEventListener('pointermove', move);
            circle.addEventListener('pointerup', up);
        });
    };
    dragHandle(handleOne, 0); dragHandle(handleTwo, 2);

    const springHost = document.createElement('div'); springHost.className = 'ink-v2-easing-spring'; springHost.hidden = true;
    // The physics explainer is documentation, not a control: it stays behind a "?" beside the tabs
    // instead of pushing the sliders down the popover.
    const springHint = document.createElement('p'); springHint.className = 'ink-v2-control-description'; springHint.hidden = true;
    springHint.textContent = 'Springs are written as the closest cubic-bezier, so the motion stays native CSS. Use a keyframe timeline when you need a real multi-bounce.';
    const springHelp = document.createElement('button'); springHelp.type = 'button'; springHelp.className = 'ink-v2-info-toggle'; springHelp.textContent = '?';
    springHelp.setAttribute('aria-label', 'About springs'); springHelp.setAttribute('aria-expanded', 'false');
    springHelp.addEventListener('click', () => { springHint.hidden = !springHint.hidden; springHelp.setAttribute('aria-expanded', String(!springHint.hidden)); });
    tabs.appendChild(springHelp);
    const springFields = {};
    const springRanges = [['stiffness', 'Stiffness', 1, 600, 1], ['damping', 'Damping', 1, 120, 1], ['mass', 'Mass', 0.1, 5, 0.1]];
    const applySpring = ({ commit = false } = {}) => {
        springState = {
            stiffness: Number(springFields.stiffness.value) || SPRING_DEFAULTS.stiffness,
            damping: Number(springFields.damping.value) || SPRING_DEFAULTS.damping,
            mass: Number(springFields.mass.value) || SPRING_DEFAULTS.mass,
        };
        points = springToBezier(springState);
        draw();
        if (commit) emit();
    };
    springRanges.forEach(([name, label, min, max, step]) => {
        const row = document.createElement('label'); row.className = 'ink-v2-easing-spring-field';
        const text = document.createElement('span'); text.textContent = label;
        const range = document.createElement('input'); range.type = 'range'; range.min = String(min); range.max = String(max); range.step = String(step);
        range.value = String(springState?.[name] ?? SPRING_DEFAULTS[name]); range.setAttribute('aria-label', label);
        const value = document.createElement('output'); value.textContent = range.value;
        range.addEventListener('input', () => { value.textContent = range.value; applySpring(); });
        range.addEventListener('change', () => applySpring({ commit: true }));
        springFields[name] = range;
        row.append(text, range, value);
        springHost.appendChild(row);
    });
    const suggest = document.createElement('button'); suggest.type = 'button'; suggest.className = 'ink-v2-action-button'; suggest.textContent = 'Use recommended';
    const refreshSuggest = () => { suggest.title = `Sets the duration to about when the spring settles (${springSettleMs(springState || SPRING_DEFAULTS)}ms)`; };
    suggest.addEventListener('click', () => { if (onDuration) onDuration(springSettleMs(springState || SPRING_DEFAULTS)); });
    refreshSuggest();
    springHost.append(springHint, suggest);

    const selectEasingTab = (name) => {
        const springActive = name === 'spring';
        springHost.hidden = !springActive; svg.hidden = springActive;
        curveTab.classList.toggle('is-active', !springActive); springTab.classList.toggle('is-active', springActive);
        curveTab.setAttribute('aria-selected', String(!springActive)); springTab.setAttribute('aria-selected', String(springActive));
    };
    // The editor needs more room than the sidebar gives it, so the popover is positioned against the
    // button and pinned to the viewport: it stays inside the panel's DOM (and its tests) while
    // reading as its own surface outside the panel's width.
    let positioned = null;
    const positionBody = () => {
        if (body.hidden) return;
        const rect = toggle.getBoundingClientRect();
        const width = Math.min(300, window.innerWidth - 24);
        const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
        const height = body.offsetHeight;
        const below = rect.bottom + 6;
        body.style.position = 'fixed';
        body.style.width = `${width}px`;
        body.style.left = `${left}px`;
        body.style.top = `${below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below}px`;
    };
    const closeBody = () => {
        body.hidden = true; toggle.setAttribute('aria-expanded', 'false');
        if (positioned) { positioned.abort(); positioned = null; }
    };
    const openBody = () => {
        body.hidden = false; toggle.setAttribute('aria-expanded', 'true');
        draw(); refreshSuggest();
        // Reposition while the popover is open: the panel scrolls under a viewport-pinned box.
        if (positioned) positioned.abort();
        positioned = new AbortController();
        const { signal } = positioned;
        window.addEventListener('resize', positionBody, { signal });
        document.addEventListener('scroll', positionBody, { capture: true, signal });
        positionBody();
    };
    curveTab.addEventListener('click', () => selectEasingTab('curve'));
    springTab.addEventListener('click', () => selectEasingTab('spring'));
    selectEasingTab(springState ? 'spring' : 'curve');
    body.append(tabs, chips, svg, springHost);

    preset.addEventListener('change', () => {
        const entry = EASING_PRESETS.find((candidate) => candidate.id === preset.value);
        if (!entry) { openBody(); return; }
        points = [...entry.points]; springState = null; draw(); emit();
    });
    toggle.addEventListener('click', () => {
        if (body.hidden) openBody(); else closeBody();
    });
    toggle.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !body.hidden) { closeBody(); toggle.focus(); } });

    draw();
    host.append(head, body);
    return { element: host, svg, setValue: () => {} };
}

// The grid track editor: a count stepper, a proportional preview rail, and one row per track, so a
// layout can be built by adding columns instead of typing a template string.
export function tracksEditor({ value, onChange, unitOptions = TRACK_UNITS } = {}) {
    const host = document.createElement('div'); host.className = 'ink-v2-tracks';
    const commit = (tracks) => onChange({ tracks, css: serializeTracks(tracks) });
    const render = (raw) => {
        const tracks = parseTracks(raw);
        host.replaceChildren();
        const rail = document.createElement('div'); rail.className = 'ink-v2-tracks-rail'; rail.setAttribute('aria-hidden', 'true');
        const weights = tracks.map((track) => {
            if (track.unit === 'fr') return Math.max(0.4, Number(track.size) || 1);
            if (['px', 'rem', 'em', 'vw', 'ch'].includes(track.unit)) return Math.max(0.4, (Number(track.size) || 1) / 60);
            return 1;
        });
        tracks.forEach((track, index) => {
            const segment = document.createElement('span'); segment.className = 'ink-v2-tracks-segment';
            segment.style.flexGrow = String(weights[index] || 1);
            segment.textContent = trackText(track);
            rail.appendChild(segment);
        });
        const head = document.createElement('div'); head.className = 'ink-v2-tracks-head';
        const count = document.createElement('div'); count.className = 'ink-v2-tracks-count';
        const less = document.createElement('button'); less.type = 'button'; less.textContent = '−'; less.disabled = tracks.length <= 1; less.setAttribute('aria-label', 'Remove the last track');
        const more = document.createElement('button'); more.type = 'button'; more.textContent = '+'; more.disabled = tracks.length >= 24; more.setAttribute('aria-label', 'Add a track');
        const countLabel = document.createElement('span'); countLabel.textContent = `${tracks.length} track${tracks.length === 1 ? '' : 's'}`;
        less.addEventListener('click', () => commit(resizeTracks(raw, tracks.length - 1)));
        more.addEventListener('click', () => commit(resizeTracks(raw, tracks.length + 1)));
        count.append(less, countLabel, more);
        const presets = document.createElement('div'); presets.className = 'ink-v2-tracks-presets';
        [[2, '2'], [3, '3'], [4, '4']].forEach(([number, label]) => {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.setAttribute('aria-label', `${number} equal tracks`);
            button.addEventListener('click', () => commit(tracksFromCount(number)));
            presets.appendChild(button);
        });
        if (!tracks.length) {
            const auto = document.createElement('button'); auto.type = 'button'; auto.className = 'ink-v2-tracks-auto'; auto.textContent = 'Auto-fit cards';
            auto.addEventListener('click', () => onChange({ tracks: parseTracks('repeat(auto-fit, minmax(220px, 1fr))'), css: 'repeat(auto-fit, minmax(220px, 1fr))' }));
            presets.appendChild(auto);
        }
        head.append(count, presets);
        const rows = document.createElement('div'); rows.className = 'ink-v2-tracks-rows';
        tracks.forEach((track, index) => {
            const row = document.createElement('div'); row.className = 'ink-v2-tracks-row';
            const unit = document.createElement('select'); unit.className = 'ink-v2-unit'; unit.setAttribute('aria-label', `Track ${index + 1} unit`);
            unitOptions.forEach((name) => unit.add(new Option(name, name)));
            unit.value = track.unit === 'raw' || track.unit === 'minmax' || track.unit === 'fit-content' ? 'auto' : track.unit;
            const size = document.createElement('input'); size.type = 'text'; size.autocomplete = 'off'; size.setAttribute('aria-label', `Track ${index + 1} size`);
            size.value = track.unit === 'raw' || track.unit === 'minmax' || track.unit === 'fit-content' ? trackText(track) : (Number.isFinite(Number(track.size)) ? String(track.size) : '');
            size.readOnly = unit.value === 'auto';
            const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove track ${index + 1}`); remove.disabled = tracks.length <= 1;
            unit.addEventListener('change', () => { const next = parseTracks(raw); const value = Number(size.value); next[index] = unit.value === 'auto' ? { unit: 'auto' } : { unit: unit.value, size: Number.isFinite(value) ? value : 1 }; commit(next); });
            size.addEventListener('change', () => {
                const parsed = parseValueInput(size.value, { current: 1, units: unitOptions, defaultUnit: unit.value });
                if (!parsed) { size.value = trackText(track); return; }
                const next = parseTracks(raw);
                next[index] = typeof parsed.size === 'number' ? { unit: parsed.unit || unit.value, size: parsed.size } : { unit: parsed.size };
                commit(next);
            });
            remove.addEventListener('click', () => commit(parseTracks(raw).filter((_, cursor) => cursor !== index)));
            row.append(unit, size, remove);
            rows.appendChild(row);
        });
        host.append(head, rail, rows);
    };
    render(value);
    return { element: host, setValue: (next) => render(next) };
}

// The keyframe timeline: a row per keyframe with its position, transform and opacity, a raw JSON
// escape hatch for anything else, and a preview that plays the real animation on the canvas.
// Property values the author did not touch survive an edit, so a hand-written or imported keyframe
// is never flattened into a subset.
export function motionTimeline({ frames, onChange, onPreview = null } = {}) {
    const list = Array.isArray(frames) ? frames : [];
    const host = document.createElement('div'); host.className = 'ink-v2-timeline';
    const rows = document.createElement('div'); rows.className = 'ink-v2-timeline-rows';
    const position = (frame, index) => {
        const offset = Number(frame?.offset);
        return Number.isFinite(offset) ? Math.max(0, Math.min(1, offset)) : index / Math.max(1, list.length - 1);
    };
    const edit = (index, patch) => onChange(list.map((frame, cursor) => (cursor === index ? { ...frame, ...patch } : { ...frame })));
    list.forEach((frame, index) => {
        const row = document.createElement('div'); row.className = 'ink-v2-timeline-row';
        const positionLabel = document.createElement('label'); positionLabel.className = 'ink-v2-timeline-position';
        const offset = numericField({ value: Math.round(position(frame, index) * 100), min: 0, max: 100, step: 5, ariaLabel: `Keyframe ${index + 1} position`, handle: positionLabel, onSet: (next) => edit(index, { offset: Math.round(Number(next) || 0) / 100 }) });
        positionLabel.append(offset.element, '%');
        const transform = document.createElement('input'); transform.type = 'text'; transform.className = 'ink-v2-timeline-transform'; transform.spellcheck = false;
        transform.value = frame.transform ?? ''; transform.placeholder = 'translateY(24px)'; transform.setAttribute('aria-label', `Keyframe ${index + 1} transform`);
        commitOnFinish(transform, () => edit(index, { transform: transform.value.trim() }));
        const opacity = document.createElement('input'); opacity.type = 'text'; opacity.className = 'ink-v2-timeline-opacity'; opacity.inputMode = 'decimal';
        opacity.value = frame.opacity === undefined || frame.opacity === null ? '' : String(frame.opacity); opacity.placeholder = 'opacity'; opacity.setAttribute('aria-label', `Keyframe ${index + 1} opacity`);
        commitOnFinish(opacity, () => { const next = opacity.value.trim(); edit(index, { opacity: next === '' ? '' : Math.max(0, Math.min(1, Number(next) || 0)) }); });
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove keyframe ${index + 1}`); remove.disabled = list.length <= 2;
        remove.addEventListener('click', () => onChange(list.filter((_, cursor) => cursor !== index)));
        row.append(positionLabel, transform, opacity, remove);
        rows.appendChild(row);
    });
    host.appendChild(rows);

    const tools = document.createElement('div'); tools.className = 'ink-v2-timeline-tools';
    const add = document.createElement('button'); add.type = 'button'; add.className = 'ink-v2-action-button'; add.textContent = 'Add keyframe';
    add.addEventListener('click', () => {
        const last = position(list.at(-1), list.length - 1);
        const previous = list.length > 1 ? position(list.at(-2), list.length - 2) : Math.max(0, last - 0.25);
        const offset = Math.round(Math.min(1, (last + previous) / 2 + 0.25) * 100) / 100;
        const template = list.at(-1) || {};
        onChange([...list.map((frame) => ({ ...frame })), { offset, ...(template.transform ? { transform: template.transform } : {}) }]);
    });
    tools.appendChild(add);
    if (onPreview) {
        const play = document.createElement('button'); play.type = 'button'; play.className = 'ink-v2-action-button'; play.textContent = 'Play preview';
        play.addEventListener('click', () => { if (!onPreview()) play.textContent = 'Select the layer first'; });
        tools.appendChild(play);
    }
    host.appendChild(tools);

    const raw = document.createElement('details'); raw.className = 'ink-v2-timeline-raw';
    const summary = document.createElement('summary'); summary.textContent = 'Raw keyframes';
    const textarea = document.createElement('textarea'); textarea.className = 'ink-v2-code'; textarea.rows = 6; textarea.spellcheck = false;
    textarea.value = JSON.stringify(list, null, 2); textarea.setAttribute('aria-label', 'Keyframes as JSON');
    const status = document.createElement('small'); status.className = 'ink-v2-field-note'; status.hidden = true;
    commitOnFinish(textarea, () => {
        try {
            const parsed = JSON.parse(textarea.value);
            if (!Array.isArray(parsed) || parsed.length < 2) throw new Error('Use at least two keyframes');
            status.hidden = true; textarea.removeAttribute('aria-invalid'); onChange(parsed);
        } catch (error) {
            status.textContent = error.message; status.hidden = false; textarea.setAttribute('aria-invalid', 'true');
        }
    });
    raw.append(summary, textarea, status);
    host.appendChild(raw);
    return { element: host };
}

// What a selector actually points at, in the author's words: read the canvas, not the CSS.
export function resolveTargetLabel(panel, selector) {
    const root = panel?.runtime?.canvas?.root;
    if (!selector || !root) return '';
    let element = null;
    try { element = root.querySelector(selector); } catch (error) { return ''; }
    if (!element) return '';
    const id = element.dataset?.inkElementId || element.closest?.('[data-ink-element-id]')?.dataset?.inkElementId;
    const node = id ? panel.runtime.document.get(id) : null;
    if (!node) return '';
    const definition = panel.runtime.elements.get(node.type);
    return `${node.settings.label || definition.title} (${definition.title})`;
}

/* ------------------------------------------------------------------ *
 * Switcher / slider / gaps / dimensions (value editors)
 * ------------------------------------------------------------------ */

export function switcher(panel, control, node, value, row) {
    const initial = (value === '' || value === undefined) && control.default !== undefined ? !!control.default : value === true || value === control.returnValue || value === 'yes';
    const { wrapper, checkbox } = switchControl({ checked: initial, onLabel: control.onLabel || 'Yes', offLabel: control.offLabel || 'No', ariaLabel: control.label });
    checkbox.addEventListener('change', () => panel.setValue(control, node, checkbox.checked ? (control.returnValue ?? true) : (control.offValue ?? false)));
    row.appendChild(wrapper); return row;
}

// A plain number, with optional units, using the shared scrub/arithmetic field.
export function number(panel, control, node, value, row) {
    const field = numericField({
        value, units: control.units || null, defaultUnit: control.defaultUnit || control.units?.[0] || 'px',
        min: control.min ?? null, max: control.max ?? null, step: control.step ?? 1,
        ariaLabel: control.label || control.name, placeholder: control.placeholder || '',
        handle: row.querySelector(':scope > label'),
        onLive: (next) => panel.scrubValue(control, node, next, false),
        onCommit: (next) => panel.scrubValue(control, node, next, true),
        onSet: (next) => panel.setValue(control, node, next),
    });
    row.appendChild(field.element);
    return row;
}

// A size always carries a unit, so "24" can become 24px, 24rem, or 24% — the author types the unit
// they mean instead of hunting for the select.
export function size(panel, control, node, value, row) {
    const field = numericField({
        value, units: control.units || ['px'], defaultUnit: control.units?.[0] || 'px',
        min: control.min ?? null, max: control.max ?? null, step: control.step ?? 1,
        ariaLabel: control.label || control.name, placeholder: control.placeholder || '',
        handle: row.querySelector(':scope > label'),
        onLive: (next) => panel.scrubValue(control, node, next, false),
        onCommit: (next) => panel.scrubValue(control, node, next, true),
        onSet: (next) => panel.setValue(control, node, next),
    });
    row.appendChild(field.element);
    return row;
}

// Grid tracks: columns (or rows) as editable tracks instead of a template string nobody can parse.
export function gridTracks(panel, control, node, value, row) {
    const editor = tracksEditor({
        value: String(value ?? ''),
        onChange: ({ css }) => panel.setValue(control, node, css),
    });
    row.appendChild(editor.element);
    const hint = document.createElement('small'); hint.className = 'ink-v2-control-description';
    hint.textContent = 'Written straight to the grid template. A uniform list is saved as repeat(n, …).';
    row.appendChild(hint);
    return row;
}

// Animation presets are the designer-facing half of motion: pick what should happen and the panel
// writes the keyframes. The timeline stays available for exactly what the presets cannot say.
const MOTION_PRESETS = [
    { id: 'fade-in', label: 'Fade in', frames: [{ offset: 0, opacity: 0 }, { offset: 1, opacity: 1 }] },
    { id: 'fade-up', label: 'Fade + move up', frames: [{ offset: 0, opacity: 0, transform: 'translateY(24px)' }, { offset: 1, opacity: 1, transform: 'translateY(0)' }] },
    { id: 'scale-in', label: 'Scale in', frames: [{ offset: 0, opacity: 0, transform: 'scale(0.9)' }, { offset: 1, opacity: 1, transform: 'scale(1)' }] },
    { id: 'slide-in', label: 'Slide in from left', frames: [{ offset: 0, opacity: 0, transform: 'translateX(-32px)' }, { offset: 1, opacity: 1, transform: 'translateX(0)' }] },
];
const motionFrameSignature = (list) => (Array.isArray(list) ? list : []).map((frame) => `${Number(frame?.offset)}|${frame?.opacity ?? ''}|${frame?.transform ?? ''}`).join('~');
const motionPresetFor = (frames, enabled) => (enabled === false ? 'none' : (MOTION_PRESETS.find((preset) => motionFrameSignature(preset.frames) === motionFrameSignature(frames))?.id || 'custom'));
// Name the effect, not the mechanics: "Fade + Move", not "two keyframes".
const describeMotionFrames = (frames) => {
    const list = Array.isArray(frames) ? frames : [];
    if (!list.length) return 'No animation yet';
    const transforms = list.map((frame) => String(frame?.transform || '')).join(' ');
    const parts = [];
    if (list.some((frame) => frame?.opacity !== undefined && frame?.opacity !== null && frame?.opacity !== '')) parts.push('Fade');
    if (/scale\(/.test(transforms)) parts.push('Scale');
    if (/rotate\(/.test(transforms)) parts.push('Rotate');
    if (/translateY/.test(transforms)) parts.push('Move');
    if (/translateX/.test(transforms)) parts.push('Slide');
    return parts.length ? parts.join(' + ') : 'Custom motion';
};

export function motion(panel, control, node, value, row) {
    const current = value && typeof value === 'object' ? value : {};
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-motion-control';
    // Composite controls build their own label rows so the inner number fields can scrub from the
    // label that names them ("Duration (ms)"), not from the whole control's title.
    const makeField = (labelText, host = wrapper) => { const label = document.createElement('label'); label.textContent = labelText; host.appendChild(label); return label; };
    const field = (labelText, input, host = wrapper) => { const label = makeField(labelText, host); label.appendChild(input); return input; };
    let enabled = current.enabled !== false;
    let frames = Array.isArray(current.keyframes) && current.keyframes.length ? current.keyframes.map((frame) => ({ ...frame })) : [{ offset: 0, opacity: 0, transform: 'translateY(24px)' }, { offset: 1, opacity: 1, transform: 'translateY(0)' }];

    // The first decision is "what should happen", not "which CSS properties". Choosing a preset
    // writes the keyframes; the timeline below is the escape hatch, not the entry point.
    const animation = document.createElement('select'); animation.setAttribute('aria-label', 'Animation');
    animation.add(new Option('None', 'none'));
    MOTION_PRESETS.forEach((preset) => animation.add(new Option(preset.label, preset.id)));
    animation.add(new Option('Custom keyframes', 'custom'));
    animation.value = motionPresetFor(frames, enabled);

    const trigger = document.createElement('select'); Object.entries({ load: 'Page load', hover: 'Hover', enter: 'Section enters view', scroll: 'Section scroll progress' }).forEach(([name, label]) => trigger.add(new Option(label, name))); trigger.value = current.trigger || 'load';
    const iterations = document.createElement('input'); iterations.type = 'text'; iterations.value = current.iterations ?? 1; iterations.placeholder = '1 or infinite'; iterations.setAttribute('aria-label', 'Iterations');
    const direction = document.createElement('select'); ['normal', 'reverse', 'alternate', 'alternate-reverse'].forEach((name) => direction.add(new Option(name, name))); direction.value = current.direction || 'normal'; direction.setAttribute('aria-label', 'Direction');

    // Authored state lives here, so every commit writes one coherent motion object and the easing
    // that reaches the page is always a string the stylesheet accepts.
    let easingState = { easing: validateEasing(current.easing) || easingCss(parseEasing(current.easing).points), spring: current.spring && typeof current.spring === 'object' ? { ...current.spring } : null };

    field('Animation', animation);
    const summary = document.createElement('div'); summary.className = 'ink-v2-motion-summary';
    const summaryText = document.createElement('span'); summaryText.className = 'ink-v2-motion-summary-text';
    const previewButton = document.createElement('button'); previewButton.type = 'button'; previewButton.className = 'ink-v2-action-button'; previewButton.textContent = 'Preview';
    summary.append(summaryText, previewButton);
    wrapper.appendChild(summary);
    field('Trigger', trigger);
    const durationLabel = makeField('Duration (ms)');
    const durationField = numericField({ value: current.duration || 800, min: 1, step: 50, ariaLabel: 'Duration in milliseconds', handle: durationLabel, onSet: (next) => write({ duration: Math.max(1, Math.round(Number(next) || 800)) }) });
    durationLabel.appendChild(durationField.element);
    const delayLabel = makeField('Delay (ms)');
    const delayField = numericField({ value: current.delay || 0, step: 50, ariaLabel: 'Delay in milliseconds', handle: delayLabel, onSet: (next) => write({ delay: Math.round(Number(next) || 0) }) });
    delayLabel.appendChild(delayField.element);

    function write(patch = {}) {
        if (patch.easing !== undefined || patch.spring !== undefined) easingState = { easing: patch.easing ?? easingState.easing, spring: patch.spring === undefined ? easingState.spring : patch.spring };
        if (patch.keyframes) frames = patch.keyframes;
        const payload = {
            enabled: enabled, trigger: trigger.value,
            duration: Math.max(1, Math.round(Number(durationField.input.value) || 800)),
            delay: Math.round(Number(delayField.input.value) || 0),
            easing: easingState.easing,
            iterations: iterations.value === 'infinite' ? 'infinite' : Math.max(1, Math.round(Number(iterations.value) || 1)),
            direction: direction.value,
            keyframes: frames,
        };
        if (easingState.spring) payload.spring = easingState.spring;
        panel.setValue(control, node, payload);
    }

    // Preview through the browser's own animation engine, so the author watches the real motion
    // without the panel mutating the page's stylesheet.
    const previewMotion = () => {
        const element = panel.runtime.canvas?.instances?.get(node.id)?.element;
        if (!element?.animate || !frames.length) return false;
        const browserFrames = frames.map((frame, index) => {
            const { offset, ...rest } = frame;
            const position = Number(offset);
            return { offset: Number.isFinite(position) ? Math.max(0, Math.min(1, position)) : index / Math.max(1, frames.length - 1), ...rest };
        });
        element.getAnimations?.().forEach((running) => running.cancel());
        element.animate(browserFrames, {
            duration: Math.max(1, Number(durationField.input.value) || 800),
            delay: Number(delayField.input.value) || 0,
            easing: easingState.easing,
            iterations: iterations.value === 'infinite' ? Infinity : Math.max(1, Number(iterations.value) || 1),
            direction: direction.value,
            fill: 'both',
        });
        return true;
    };
    previewButton.addEventListener('click', () => previewMotion());

    // Everything a designer rarely touches lives behind one disclosure: iterations, direction, the
    // easing curve and spring tuning, and the raw keyframe timeline.
    const advanced = document.createElement('details'); advanced.className = 'ink-v2-motion-advanced';
    advanced.innerHTML = '<summary><span>Advanced</span><span class="ink-v2-section-chevron" aria-hidden="true">⌄</span></summary>';
    const advancedBody = document.createElement('div'); advancedBody.className = 'ink-v2-motion-advanced-body';
    advanced.appendChild(advancedBody);
    advanced.open = Boolean(current.spring) || (current.easing !== undefined && !['ease', 'linear'].includes(String(current.easing))) || String(current.iterations ?? '1') !== '1' || (current.direction || 'normal') !== 'normal';
    wrapper.appendChild(advanced);

    const easingHost = easingEditor({
        value: easingState.easing, spring: easingState.spring,
        onChange: ({ easing, spring }) => write({ easing, spring }),
        onDuration: (milliseconds) => { durationField.setValue(milliseconds); write({ duration: milliseconds }); },
    });
    const timeline = motionTimeline({ frames, onChange: (next) => write({ keyframes: next }), onPreview: previewMotion });
    field('Iterations', iterations, advancedBody);
    field('Direction', direction, advancedBody);
    const easingLabel = makeField('Easing', advancedBody); easingLabel.appendChild(easingHost.element);
    const timelineLabel = makeField('Keyframes', advancedBody); timelineLabel.appendChild(timeline.element);

    const hint = document.createElement('small'); hint.className = 'ink-v2-motion-hint';
    hint.textContent = 'Scroll motion follows this layer through the viewport and runs once.';
    wrapper.appendChild(hint);

    const refreshSummary = () => {
        const milliseconds = Math.max(1, Math.round(Number(durationField.input.value) || 800));
        summaryText.textContent = enabled ? `${describeMotionFrames(frames)} · ${milliseconds}ms` : 'No animation';
        previewButton.disabled = !enabled || !frames.length;
    };
    const syncFields = () => {
        const scroll = trigger.value === 'scroll';
        durationField.input.disabled = scroll; delayField.input.disabled = scroll;
        iterations.disabled = ['scroll', 'enter'].includes(trigger.value);
        direction.disabled = iterations.disabled;
        hint.hidden = !iterations.disabled;
    };
    animation.addEventListener('change', () => {
        const preset = MOTION_PRESETS.find((entry) => entry.id === animation.value);
        if (animation.value === 'none') enabled = false;
        else { enabled = true; if (preset) frames = preset.frames.map((frame) => ({ ...frame })); }
        write({ keyframes: frames });
        refreshSummary(); syncFields();
    });
    trigger.addEventListener('change', () => { syncFields(); write(); });
    [iterations, direction].forEach((input) => input.addEventListener('change', () => write()));
    [durationField.input, delayField.input].forEach((input) => input.addEventListener('change', () => { refreshSummary(); }));
    syncFields(); refreshSummary();
    row.appendChild(wrapper); return row;
}

// Motion group: the orchestration layer above per-layer motion. It shares one trigger across the
// children of this element, staggers their starts, and -- for scroll groups -- names the reference
// they scrub against, so a whole section advances off one progress value. Rendered as an editable
// timeline summary so the author sees exactly which layers take part and when each one starts.
export function motionGroup(panel, control, node, value, row) {
    const group = normalizeMotionGroup(value);
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-motion-group-control';
    const field = (labelText, input) => { const label = document.createElement('label'); label.textContent = labelText; label.appendChild(input); wrapper.appendChild(label); return input; };
    const enabledControl = switchControl({ checked: !!group, ariaLabel: 'Orchestrate children as one timeline', onLabel: 'Group', offLabel: 'Off' });
    const enabled = enabledControl.checkbox;
    const kind = document.createElement('select'); MOTION_GROUP_KINDS.forEach((name) => kind.add(new Option(MOTION_GROUP_KIND_LABELS[name] || name, name))); kind.value = group?.kind || 'group';
    const trigger = document.createElement('select'); MOTION_GROUP_TRIGGERS.forEach((name) => trigger.add(new Option(MOTION_GROUP_TRIGGER_LABELS[name] || name, name))); trigger.value = group?.trigger || 'inherit';
    const stagger = document.createElement('input'); stagger.type = 'number'; stagger.min = '0'; stagger.step = '25'; stagger.value = group?.stagger ?? 0;
    const duration = document.createElement('input'); duration.type = 'number'; duration.min = '0'; duration.step = '50'; duration.value = group?.duration ?? 0; duration.placeholder = 'each layer';
    // The group can inherit each layer's own easing (the default) or apply one curve to the whole
    // timeline; the editor writes the same validated cubic-bezier the single-layer Motion uses.
    let groupEasing = group?.easing || '';
    const easingHost = easingEditor({
        value: groupEasing || 'ease',
        onChange: ({ easing }) => { groupEasing = easing; syncAndCommit(); },
    });
    const easingInherit = document.createElement('button'); easingInherit.type = 'button'; easingInherit.className = 'ink-v2-action-button';
    const syncInherit = () => { easingInherit.textContent = groupEasing ? 'Use each layer\'s own easing' : 'Every layer keeps its own easing'; easingInherit.disabled = !groupEasing; };
    easingInherit.addEventListener('click', () => { groupEasing = ''; syncInherit(); syncAndCommit(); });
    const reference = document.createElement('select'); [['group', 'The group section'], ['parent', 'The group\u2019s parent']].forEach(([name, label]) => reference.add(new Option(label, name))); reference.value = group?.scrub?.reference || 'group';
    const pinControl = switchControl({ checked: !!group?.pin?.enabled, ariaLabel: 'Pin the group while it scrubs', onLabel: 'Pinned', offLabel: 'Free' }); const pin = pinControl.checkbox;
    const distance = document.createElement('input'); distance.type = 'number'; distance.min = '0'; distance.max = '400'; distance.step = '25'; distance.value = group?.pin?.distance ?? 100;

    const scrollOnly = () => {
        reference.disabled = trigger.value !== 'scroll';
        pin.disabled = trigger.value !== 'scroll';
        distance.disabled = trigger.value !== 'scroll' || !pin.checked;
    };
    const commit = () => {
        if (!enabled.checked) { panel.setValue(control, node, null); return; }
        panel.setValue(control, node, normalizeMotionGroup({
            kind: kind.value, trigger: trigger.value, stagger: Number(stagger.value) || 0,
            duration: Number(duration.value) || 0, easing: groupEasing,
            scrub: { reference: reference.value }, pin: { enabled: pin.checked, distance: Number(distance.value) || 0 },
        }));
    };
    const status = document.createElement('small'); status.className = 'ink-v2-control-description';
    const sync = () => {
        scrollOnly();
        const preview = normalizeMotionGroup({
            kind: kind.value, trigger: trigger.value, stagger: Number(stagger.value) || 0,
            duration: Number(duration.value) || 0, easing: groupEasing,
            scrub: { reference: reference.value }, pin: { enabled: pin.checked, distance: Number(distance.value) || 0 },
        });
        const items = motionGroupItems({ ...node, settings: { ...node.settings, motionGroup: preview } });
        status.textContent = items.length
            ? `${describeMotionGroup(preview)} \u2014 ${items.length} layer${items.length === 1 ? '' : 's'} (${items.map((item) => `${item.delay}ms`).join(', ')})`
            : 'No child layer has keyframes yet. Add Animation to the children, then they play as one timeline.';
    };
    const syncAndCommit = () => { sync(); commit(); };
    [enabled, kind, trigger, stagger, duration, reference, pin, distance].forEach((input) => input.addEventListener('change', syncAndCommit));
    field('Orchestrate', enabledControl.wrapper); field('Kind', kind); field('Trigger', trigger); field('Stagger (ms)', stagger); field('Duration (ms)', duration); field('Easing', easingHost.element); wrapper.appendChild(easingInherit); field('Scroll reference', reference); field('Pin', pinControl.wrapper); field('Pinned distance (vh)', distance);
    wrapper.appendChild(status); syncInherit(); sync();
    row.appendChild(wrapper); return row;
}

// Sticky: a plain layout capability any layer can opt into. It is the missing half of a pinned
// scroll timeline -- the tall group section plus a sticky stage -- and it is also how a site's
// own `position: sticky` header is preserved on import.
export function sticky(panel, control, node, value, row) {
    const stickyValue = value && typeof value === 'object' ? value : {};
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-sticky-control';
    const field = (labelText, input) => { const label = document.createElement('label'); label.textContent = labelText; label.appendChild(input); wrapper.appendChild(label); return input; };
    const { wrapper: toggleWrapper, checkbox } = switchControl({ checked: !!value && stickyValue.enabled !== false, ariaLabel: 'Sticky positioning', onLabel: 'Sticky', offLabel: 'Static' });
    const top = document.createElement('input'); top.type = 'number'; top.step = '1'; top.value = Number.isFinite(Number(stickyValue.top)) ? Number(stickyValue.top) : 0;
    const zIndex = document.createElement('input'); zIndex.type = 'number'; zIndex.step = '1'; zIndex.value = Number.isFinite(Number(stickyValue.zIndex)) ? Number(stickyValue.zIndex) : 10;
    const commit = () => {
        if (!checkbox.checked) { panel.setValue(control, node, null); return; }
        panel.setValue(control, node, { enabled: true, top: Number(top.value) || 0, zIndex: Number(zIndex.value) || 10 });
    };
    [checkbox, top, zIndex].forEach((input) => input.addEventListener('change', commit));
    field('Position', toggleWrapper); field('Offset from top (px)', top); field('Z-index', zIndex);
    const hint = document.createElement('small'); hint.className = 'ink-v2-control-description'; hint.textContent = 'Pin this layer inside its scroll container. Build a pinned timeline as a tall motion group whose stage is sticky.'; wrapper.appendChild(hint);
    row.appendChild(wrapper); return row;
}

export function slider(panel, control, node, value, row) {
    const host = document.createElement('div'); host.className = 'ink-v2-slider';
    const range = document.createElement('input'); range.type = 'range'; range.min = control.min ?? 0; range.max = control.max ?? 100; range.step = control.step ?? 1;
    const number = document.createElement('input'); number.type = 'number'; number.min = range.min; number.max = range.max; number.step = range.step;
    const size = value && typeof value === 'object' ? value.size : value;
    const initial = size === '' || size === undefined || size === null ? (control.default ?? control.min ?? 0) : size;
    range.value = initial; number.value = range.value;
    const unit = control.units ? document.createElement('select') : null;
    if (unit) { unit.className = 'ink-v2-unit'; control.units.forEach((name) => unit.add(new Option(name, name))); unit.value = value?.unit || control.units[0]; }
    const commit = (source) => { if (source) { range.value = source.value; number.value = range.value; } panel.setValue(control, node, unit ? { size: Number(number.value), unit: unit.value } : Number(number.value)); };
    range.setAttribute('aria-label', control.label || control.name); number.setAttribute('aria-label', `${control.label || control.name} value`);
    const scrub = (finish) => { number.value = range.value; panel.scrubValue(control, node, unit ? { size: Number(range.value), unit: unit.value } : Number(range.value), finish); };
    range.addEventListener('input', () => scrub(false));
    range.addEventListener('change', () => scrub(true)); range.addEventListener('blur', () => { if (panel.scrubbing) scrub(true); });
    commitOnFinish(number, () => commit(number)); unit?.addEventListener('change', () => commit());
    host.append(range, number); if (unit) host.appendChild(unit); row.appendChild(host); return row;
}

export function gaps(panel, control, node, value, row) {
    const gaps = value && typeof value === 'object' ? value : {};
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gaps';
    const rowGap = document.createElement('input'); rowGap.type = 'number'; rowGap.placeholder = 'Row'; rowGap.value = gaps.row ?? '';
    const columnGap = document.createElement('input'); columnGap.type = 'number'; columnGap.placeholder = 'Column'; columnGap.value = gaps.column ?? '';
    const unit = document.createElement('select'); (control.units || ['px']).forEach((name) => unit.add(new Option(name, name))); unit.value = gaps.unit || control.units?.[0] || 'px';
    let linked = gaps.linked !== false; const link = document.createElement('button'); link.type = 'button'; link.className = 'ink-v2-link-values'; link.title = 'Link row and column gap'; link.setAttribute('aria-label', link.title); link.innerHTML = '<span class="material-symbols-rounded">link</span>'; link.classList.toggle('is-active', linked);
    const commit = (source) => { if (linked && source === rowGap) columnGap.value = rowGap.value; if (linked && source === columnGap) rowGap.value = columnGap.value; panel.setValue(control, node, { row: Number(rowGap.value) || 0, column: Number(columnGap.value) || 0, unit: unit.value, linked }); };
    link.addEventListener('click', () => { linked = !linked; link.classList.toggle('is-active', linked); if (linked) { columnGap.value = rowGap.value; commit(); } });
    rowGap.addEventListener('change', () => commit(rowGap)); columnGap.addEventListener('change', () => commit(columnGap)); unit.addEventListener('change', () => commit()); wrapper.append(rowGap, columnGap, unit, link); row.appendChild(wrapper); return row;
}

const flowSvg = (mode) => {
    const common = 'viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"';
    if (mode === 'vertical') return `<svg ${common}><rect x="3" y="2" width="4" height="4" rx=".75"/><rect x="9" y="2" width="4" height="4" rx=".75"/><path d="M8 8v5m0 0-2-2m2 2 2-2"/></svg>`;
    if (mode === 'horizontal') return `<svg ${common}><rect x="2" y="3" width="4" height="4" rx=".75"/><rect x="2" y="9" width="4" height="4" rx=".75"/><path d="M8 8h5m0 0-2-2m2 2-2 2"/></svg>`;
    if (mode === 'grid') return `<svg ${common}><rect x="2" y="2" width="4" height="4" rx=".75"/><rect x="10" y="2" width="4" height="4" rx=".75"/><rect x="2" y="10" width="4" height="4" rx=".75"/><rect x="10" y="10" width="4" height="4" rx=".75"/></svg>`;
    return `<svg ${common}><rect x="2" y="2" width="4" height="4" rx=".75"/><rect x="10" y="3" width="4" height="4" rx=".75"/><rect x="5" y="10" width="4" height="4" rx=".75"/></svg>`;
};

const layoutStyleControl = (control, name) => ({ ...control, type: 'text', target: 'styles', name, state: 'base' });

export function layoutFlow(panel, control, node, _value, row) {
    row.classList.add('ink-v2-layout-flow-control');
    const displayControl = layoutStyleControl(control, 'display');
    const directionControl = layoutStyleControl(control, 'flex-direction');
    const display = panel.currentValue(displayControl, node) || 'flex';
    const direction = panel.currentValue(directionControl, node) || 'column';
    const active = display === 'grid' ? 'grid' : display === 'block' ? 'free' : direction.startsWith('row') ? 'horizontal' : 'vertical';
    const host = document.createElement('div'); host.className = 'ink-v2-layout-flow-host';
    const choices = document.createElement('div'); choices.className = 'ink-v2-layout-flow'; choices.setAttribute('role', 'radiogroup'); choices.setAttribute('aria-label', 'Layout flow');
    [['free', 'Freeform'], ['vertical', 'Vertical'], ['horizontal', 'Horizontal'], ['grid', 'Grid']].forEach(([mode, label]) => {
        const button = document.createElement('button'); button.type = 'button'; button.title = label; button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', active === mode ? 'true' : 'false'); button.classList.toggle('is-active', active === mode); button.innerHTML = flowSvg(mode);
        button.addEventListener('click', () => {
            panel.runtime.history.begin(`Change flow to ${label}`);
            if (mode === 'grid') panel.setValue(displayControl, node, 'grid');
            else if (mode === 'free') panel.setValue(displayControl, node, 'block');
            else {
                panel.setValue(displayControl, node, 'flex');
                panel.setValue(directionControl, node, mode === 'horizontal' ? 'row' : 'column');
            }
            panel.runtime.history.commit();
        });
        choices.appendChild(button);
    });
    const reverse = document.createElement('button'); reverse.type = 'button'; reverse.className = 'ink-v2-flow-reverse'; reverse.title = 'Reverse flow'; reverse.setAttribute('aria-label', reverse.title); reverse.setAttribute('aria-pressed', /-reverse$/.test(direction) ? 'true' : 'false'); reverse.classList.toggle('is-active', /-reverse$/.test(direction)); reverse.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 5H5.5a3.5 3.5 0 0 0 0 7H11m2-7-2-2m2 2-2 2"/></svg>';
    reverse.disabled = display !== 'flex';
    reverse.addEventListener('click', () => panel.setValue(directionControl, node, /-reverse$/.test(direction) ? direction.replace('-reverse', '') : `${direction}-reverse`));
    host.append(choices, reverse); row.appendChild(host); return row;
}

const sizingMode = (raw, property, unit = '') => raw === 'fit-content' || raw === 'max-content' || (!raw && property === 'height') ? 'hug' : raw === '100%' ? 'fill' : unit && unit !== 'px' ? 'relative' : 'fixed';

const renderResizingFields = (panel, control, node) => {
    const c = (name) => layoutStyleControl(control, name);
    const sizing = document.createElement('div'); sizing.className = 'ink-v2-resizing';
    const menus = [];
    const renderAxis = (axis, property) => {
        const current = panel.currentValue(c(property), node);
        const raw = current && typeof current === 'object' ? current.size : current;
        const currentUnit = current && typeof current === 'object' ? current.unit || 'px' : typeof current === 'string' && /%$/.test(current) ? '%' : 'px';
        const inferred = sizingMode(raw, property, currentUnit);
        const field = document.createElement('div'); field.className = 'ink-v2-resize-field';
        const prefix = document.createElement('span'); prefix.textContent = axis;
        const number = document.createElement('input'); number.type = 'number'; number.value = ['fixed', 'relative'].includes(inferred) ? parseFloat(raw) || '' : ''; number.hidden = !['fixed', 'relative'].includes(inferred); number.setAttribute('aria-label', `${axis === 'W' ? 'Width' : 'Height'} value`);
        const unit = document.createElement('select'); (property === 'width' ? ['px', '%', 'vw', 'rem'] : ['px', '%', 'vh', 'rem']).forEach((name) => unit.add(new Option(name, name))); unit.value = currentUnit; unit.hidden = !['fixed', 'relative'].includes(inferred); unit.setAttribute('aria-label', `${axis === 'W' ? 'Width' : 'Height'} unit`);
        const mode = document.createElement('button'); mode.type = 'button'; mode.textContent = inferred === 'fixed' ? 'Fixed' : inferred === 'relative' ? 'Relative' : inferred === 'fill' ? 'Fill' : 'Hug'; mode.title = `${axis === 'W' ? 'Width' : 'Height'} resizing`; mode.setAttribute('aria-label', mode.title);
        const menu = document.createElement('div'); menu.className = 'ink-v2-resize-menu'; menu.hidden = true;
        [['fixed', 'Fixed'], ['relative', 'Relative'], ['hug', 'Hug contents'], ['fill', 'Fill container']].forEach(([nextMode, label]) => {
            const option = document.createElement('button'); option.type = 'button'; option.dataset.mode = nextMode; option.classList.toggle('is-active', inferred === nextMode); option.innerHTML = `<span>${inferred === nextMode ? '✓' : ''}</span>${label}`;
            option.addEventListener('click', () => {
                const element = panel.runtime.canvas.instances.get(node.id)?.element;
                const parent = element?.parentElement;
                const parentStyle = parent && parent.ownerDocument.defaultView.getComputedStyle(parent);
                const mainAxis = parentStyle?.display === 'flex' && (parentStyle.flexDirection.startsWith('row') ? 'width' : 'height');
                const measured = element?.getBoundingClientRect()[property];
                panel.runtime.history.begin(`Set ${property} to ${label}`);
                if (nextMode === 'hug') panel.setValue(c(property), node, 'fit-content');
                else if (nextMode === 'fill') panel.setValue(c(property), node, '100%');
                else if (nextMode === 'relative') panel.setValue(c(property), node, { size: 100, unit: '%' });
                else panel.setValue(c(property), node, { size: Math.round(measured || (property === 'width' ? 320 : 200)), unit: 'px' });
                if (mainAxis === property) {
                    panel.setValue(c('flex-grow'), node, nextMode === 'fill' ? 1 : 0);
                    panel.setValue(c('flex-basis'), node, nextMode === 'fill' ? '0px' : 'auto');
                    panel.setValue(c('flex-shrink'), node, nextMode === 'fixed' ? 0 : 1);
                    if (nextMode === 'fill') panel.setValue(c(`min-${property}`), node, { size: 0, unit: 'px' });
                }
                panel.runtime.history.commit();
            });
            menu.appendChild(option);
        });
        const limits = document.createElement('div'); limits.className = 'ink-v2-resize-limits';
        [['min', `Min ${property}`], ['max', `Max ${property}`]].forEach(([kind, label]) => {
            const limit = document.createElement('label'); limit.append(label);
            const input = document.createElement('input'); input.type = 'number';
            const limitControl = c(`${kind}-${property}`); const value = panel.currentValue(limitControl, node);
            input.value = value && typeof value === 'object' ? value.size ?? '' : parseFloat(value) || '';
            commitOnFinish(input, () => panel.setValue(limitControl, node, input.value === '' ? '' : { size: Number(input.value), unit: 'px' }));
            limit.appendChild(input); limits.appendChild(limit);
        });
        menu.appendChild(limits); menus.push([menu, mode]);
        mode.addEventListener('click', () => { const opening = menu.hidden; menus.forEach(([other, trigger]) => { other.hidden = true; trigger.classList.remove('is-active'); }); menu.hidden = !opening; mode.classList.toggle('is-active', opening); });
        const commit = () => panel.setValue(c(property), node, { size: Number(number.value) || 0, unit: unit.value });
        commitOnFinish(number, commit); unit.addEventListener('change', commit);
        field.append(prefix, number, unit, mode, menu); return field;
    };
    sizing.append(renderAxis('W', 'width'), renderAxis('H', 'height'));
    return sizing;
};

// Fixed/Hug/Fill is a universal element capability, not a container-only layout option.
export function resizing(panel, control, node, _value, row) {
    row.classList.add('ink-v2-resizing-control');
    row.appendChild(renderResizingFields(panel, control, node));
    return row;
}

// Parent-relative positioning with explicit pins. A blank inset means that edge is not
// constrained; this maps cleanly to responsive CSS while retaining design-tool intent.
export function positioning(panel, control, node, _value, row) {
    row.classList.add('ink-v2-positioning-control');
    const c = (name) => layoutStyleControl(control, name);
    const host = document.createElement('div'); host.className = 'ink-v2-positioning';
    const current = panel.currentValue(c('position'), node) || 'static';
    const flowValue = panel.runtime.elements.get(node.type).acceptsChildren ? 'relative' : 'static';
    const activeMode = current === 'static' || current === 'relative' ? 'flow' : current;
    const modes = document.createElement('div'); modes.className = 'ink-v2-position-modes'; modes.setAttribute('role', 'radiogroup'); modes.setAttribute('aria-label', 'Position mode');
    [['flow', 'Flow', flowValue], ['absolute', 'Absolute', 'absolute'], ['fixed', 'Fixed', 'fixed'], ['sticky', 'Sticky', 'sticky']].forEach(([mode, label, value]) => {
        const selected = activeMode === mode;
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.classList.toggle('is-active', selected); button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', selected ? 'true' : 'false');
        button.addEventListener('click', () => panel.setValue(c('position'), node, value)); modes.appendChild(button);
    });
    host.appendChild(modes);
    if (current !== 'static') {
        const pins = document.createElement('div'); pins.className = 'ink-v2-position-pins';
        ['top', 'right', 'bottom', 'left'].forEach((side) => {
            const pinControl = c(side); const existing = panel.currentValue(pinControl, node); const raw = existing && typeof existing === 'object' ? existing.size : existing;
            const field = document.createElement('label'); field.dataset.side = side; field.append(side[0].toUpperCase());
            const input = document.createElement('input'); input.type = 'number'; input.value = raw === '' || raw === undefined || raw === null ? '' : parseFloat(raw); input.placeholder = '—'; input.setAttribute('aria-label', `${side} pin`);
            const unit = document.createElement('select'); ['px', '%', 'rem', side === 'top' || side === 'bottom' ? 'vh' : 'vw'].forEach((name) => unit.add(new Option(name, name))); unit.value = existing?.unit || 'px';
            const commit = () => panel.setValue(pinControl, node, input.value === '' ? '' : { size: Number(input.value), unit: unit.value });
            commitOnFinish(input, commit); unit.addEventListener('change', commit); field.append(input, unit); pins.appendChild(field);
        });
        host.appendChild(pins);
    }
    row.appendChild(host); return row;
}

export function alignmentGap(panel, control, node, _value, row) {
    row.classList.add('ink-v2-alignment-gap-control');
    const c = (name) => layoutStyleControl(control, name);
    const read = (name, fallback = '') => panel.currentValue(c(name), node) || fallback;
    const display = read('display', 'flex'); const direction = read('flex-direction', 'column');
    const justify = read('justify-content', 'flex-start'); const align = read('align-items', 'stretch');
    const gap = panel.currentValue(c('gap'), node); const gaps = gap && typeof gap === 'object' ? gap : { row: 0, column: 0, unit: 'px', linked: true };
    const paddingValue = panel.currentValue(c('padding'), node); const padding = paddingValue && typeof paddingValue === 'object' ? paddingValue : { top: 0, right: 0, bottom: 0, left: 0, unit: 'px', linked: false };
    const host = document.createElement('div'); host.className = `ink-v2-auto-layout is-${display === 'grid' ? 'grid' : display === 'block' ? 'free' : direction.startsWith('row') ? 'horizontal' : 'vertical'}`;
    const sizingLabel = document.createElement('span'); sizingLabel.className = 'ink-v2-auto-layout-label'; sizingLabel.textContent = 'Resizing'; host.appendChild(sizingLabel);
    host.appendChild(renderResizingFields(panel, control, node));
    const top = document.createElement('div'); top.className = 'ink-v2-auto-layout-grid';
    const alignmentField = document.createElement('div'); alignmentField.className = 'ink-v2-auto-layout-field'; alignmentField.innerHTML = '<span>Alignment</span>';
    const alignment = document.createElement('div'); alignment.className = 'ink-v2-alignment-grid'; alignment.setAttribute('role', 'radiogroup'); alignment.setAttribute('aria-label', 'Content alignment');
    const normalize = (value) => value === 'flex-start' || value === 'start' ? 'start' : value === 'flex-end' || value === 'end' ? 'end' : value === 'center' ? 'center' : '';
    const horizontalValue = (direction.startsWith('row') ? normalize(justify) : normalize(align)) || 'start';
    const verticalValue = (direction.startsWith('row') ? normalize(align) : normalize(justify)) || 'start';
    ['start', 'center', 'end'].forEach((vertical) => ['start', 'center', 'end'].forEach((horizontal) => {
        const selected = horizontalValue === horizontal && verticalValue === vertical;
        const button = document.createElement('button'); button.type = 'button'; button.title = `${vertical} ${horizontal}`; button.setAttribute('aria-label', `${vertical} ${horizontal}`); button.setAttribute('aria-pressed', selected ? 'true' : 'false'); button.classList.toggle('is-active', selected);
        const mark = document.createElement('span'); mark.className = 'ink-v2-alignment-mark'; const markCount = selected ? (display === 'grid' ? 4 : 3) : 1; for (let index = 0; index < markCount; index += 1) mark.appendChild(document.createElement('i')); button.appendChild(mark);
        button.addEventListener('click', () => {
            const css = (value) => value === 'start' ? 'flex-start' : value === 'end' ? 'flex-end' : 'center';
            panel.runtime.history.begin('Change content alignment');
            panel.setValue(c(direction.startsWith('row') ? 'justify-content' : 'align-items'), node, css(horizontal));
            panel.setValue(c(direction.startsWith('row') ? 'align-items' : 'justify-content'), node, css(vertical));
            panel.runtime.history.commit();
        });
        alignment.appendChild(button);
    }));
    alignmentField.appendChild(alignment);

    const gapField = document.createElement('div'); gapField.className = 'ink-v2-auto-layout-field'; gapField.innerHTML = '<span>Gap</span>';
    const gapLine = document.createElement('div'); gapLine.className = 'ink-v2-gap-line';
    const gapInput = document.createElement('label'); gapInput.className = 'ink-v2-compact-number'; gapInput.innerHTML = direction.startsWith('row') ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v10M13 3v10M6 5v6m4-6v6"/></svg>' : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10M3 13h10M5 6h6m-6 4h6"/></svg>';
    const gapNumber = document.createElement('input'); gapNumber.type = 'number'; gapNumber.value = gaps.linked !== false && Number(gaps.row) === Number(gaps.column) ? gaps.row ?? 0 : gaps.row ?? 0; gapInput.appendChild(gapNumber);
    const settings = document.createElement('button'); settings.type = 'button'; settings.className = 'ink-v2-auto-layout-settings'; settings.title = 'Auto layout settings'; settings.setAttribute('aria-label', settings.title); settings.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12M12 2v12M2 5h4M10 11h4"/></svg>';
    gapLine.append(gapInput, settings); gapField.appendChild(gapLine);
    top.append(alignmentField, gapField); host.appendChild(top);

    const paddingHeader = document.createElement('span'); paddingHeader.className = 'ink-v2-auto-layout-label'; paddingHeader.textContent = 'Padding'; host.appendChild(paddingHeader);
    const paddingLine = document.createElement('div'); paddingLine.className = 'ink-v2-padding-line';
    const pairedInput = (axis, icon, initial) => { const label = document.createElement('label'); label.className = 'ink-v2-compact-number'; label.innerHTML = icon; const input = document.createElement('input'); input.type = 'number'; input.value = initial; input.dataset.axis = axis; label.appendChild(input); return label; };
    const horizontal = pairedInput('horizontal', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3v10M14 3v10M5 5v6m6-6v6"/></svg>', Number(padding.left) === Number(padding.right) ? padding.left ?? 0 : padding.left ?? 0);
    const vertical = pairedInput('vertical', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h10M3 14h10M5 5h6M5 11h6"/></svg>', Number(padding.top) === Number(padding.bottom) ? padding.top ?? 0 : padding.top ?? 0);
    const individual = document.createElement('button'); individual.type = 'button'; individual.className = 'ink-v2-auto-layout-settings'; individual.title = 'Individual padding'; individual.setAttribute('aria-label', individual.title); individual.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h4v4H2zM10 2h4v4h-4zM2 10h4v4H2zM10 10h4v4h-4z"/></svg>';
    paddingLine.append(horizontal, vertical, individual); host.appendChild(paddingLine);

    const clip = document.createElement('label'); clip.className = 'ink-v2-clip-content'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = read('overflow') === 'hidden'; clip.append(checkbox, document.createTextNode('Clip content')); host.appendChild(clip);
    const commitGap = () => panel.setValue(c('gap'), node, { row: Number(gapNumber.value) || 0, column: Number(gapNumber.value) || 0, unit: gaps.unit || 'px', linked: true });
    const commitPadding = () => { const x = Number(horizontal.querySelector('input').value) || 0; const y = Number(vertical.querySelector('input').value) || 0; panel.setValue(c('padding'), node, { top: y, right: x, bottom: y, left: x, unit: padding.unit || 'px', linked: false }); };
    commitOnFinish(gapNumber, commitGap); commitOnFinish(horizontal.querySelector('input'), commitPadding); commitOnFinish(vertical.querySelector('input'), commitPadding); checkbox.addEventListener('change', () => panel.setValue(c('overflow'), node, checkbox.checked ? 'hidden' : 'visible'));
    const popover = document.createElement('div'); popover.className = 'ink-v2-auto-layout-popover'; popover.hidden = true;
    const popInput = (parent, labelText, value) => { const label = document.createElement('label'); label.append(labelText); const input = document.createElement('input'); input.type = 'number'; input.value = value ?? 0; label.appendChild(input); parent.appendChild(label); return input; };
    const rowGap = popInput(popover, 'Row gap', gaps.row); const columnGap = popInput(popover, 'Column gap', gaps.column); const unit = document.createElement('select'); (control.units || ['px', '%', 'em', 'rem', 'vw']).forEach((name) => unit.add(new Option(name, name))); unit.value = gaps.unit || 'px'; const distribution = document.createElement('select'); [['Packed', 'flex-start'], ['Center', 'center'], ['Space between', 'space-between'], ['Space around', 'space-around'], ['Space evenly', 'space-evenly']].forEach(([label, value]) => distribution.add(new Option(label, value))); distribution.value = justify; const wrap = document.createElement('label'); const wrapCheck = document.createElement('input'); wrapCheck.type = 'checkbox'; wrapCheck.checked = read('flex-wrap', 'nowrap') !== 'nowrap'; wrap.append(wrapCheck, document.createTextNode(' Wrap children')); popover.append(unit, distribution, wrap); host.appendChild(popover);
    const paddingPopover = document.createElement('div'); paddingPopover.className = 'ink-v2-auto-layout-popover is-padding'; paddingPopover.hidden = true;
    const paddingTop = popInput(paddingPopover, 'Top', padding.top); const paddingRight = popInput(paddingPopover, 'Right', padding.right); const paddingBottom = popInput(paddingPopover, 'Bottom', padding.bottom); const paddingLeft = popInput(paddingPopover, 'Left', padding.left);
    const paddingUnit = document.createElement('select'); (control.units || ['px', '%', 'em', 'rem', 'vw']).forEach((name) => paddingUnit.add(new Option(name, name))); paddingUnit.value = padding.unit || 'px'; paddingUnit.setAttribute('aria-label', 'Padding unit'); paddingPopover.appendChild(paddingUnit); host.appendChild(paddingPopover);
    const closePopovers = (except) => { [[popover, settings], [paddingPopover, individual]].forEach(([menu, button]) => { if (menu !== except) { menu.hidden = true; button.classList.remove('is-active'); } }); };
    const toggle = (menu, button) => { const opening = menu.hidden; closePopovers(opening ? menu : null); menu.hidden = !opening; button.classList.toggle('is-active', opening); };
    settings.addEventListener('click', () => toggle(popover, settings)); individual.addEventListener('click', () => toggle(paddingPopover, individual));
    const commitAdvanced = () => { panel.runtime.history.begin('Change auto layout settings'); panel.setValue(c('gap'), node, { row: Number(rowGap.value) || 0, column: Number(columnGap.value) || 0, unit: unit.value, linked: false }); panel.setValue(c('justify-content'), node, distribution.value); panel.setValue(c('flex-wrap'), node, wrapCheck.checked ? 'wrap' : 'nowrap'); panel.runtime.history.commit(); };
    [rowGap, columnGap, unit, distribution, wrapCheck].forEach((input) => input.addEventListener('change', commitAdvanced));
    const commitIndividualPadding = () => panel.setValue(c('padding'), node, { top: Number(paddingTop.value) || 0, right: Number(paddingRight.value) || 0, bottom: Number(paddingBottom.value) || 0, left: Number(paddingLeft.value) || 0, unit: paddingUnit.value, linked: false });
    [paddingTop, paddingRight, paddingBottom, paddingLeft, paddingUnit].forEach((input) => input.addEventListener('change', commitIndividualPadding));
    row.appendChild(host); return row;
}

export function dimensions(panel, control, node, value, row) {
    const scalar = value && typeof value === 'object' ? value.size : typeof value === 'number' ? value : undefined;
    const dimensions = scalar !== undefined ? { top: scalar, right: scalar, bottom: scalar, left: scalar, unit: value?.unit || 'px', linked: true } : value && typeof value === 'object' ? value : {};
    if (control.name === 'border-radius') {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-radius-control';
        const number = document.createElement('input'); number.type = 'number'; number.min = 0;
        const sides = ['top', 'right', 'bottom', 'left']; const equal = sides.every((side) => (dimensions[side] || 0) === (dimensions.top || 0));
        number.value = equal ? dimensions.top || 0 : ''; number.placeholder = 'Mixed'; number.setAttribute('aria-label', 'Corner radius');
        const unit = document.createElement('select'); (control.units || ['px']).forEach((name) => unit.add(new Option(name, name))); unit.value = dimensions.unit || 'px'; unit.setAttribute('aria-label', 'Radius unit');
        const individual = document.createElement('button'); individual.type = 'button'; individual.textContent = '⌗'; individual.title = 'Individual corners'; individual.setAttribute('aria-label', individual.title);
        const fields = document.createElement('div'); fields.className = 'ink-v2-radius-corners'; fields.hidden = equal;
        const inputs = sides.map((side, index) => { const label = document.createElement('label'); label.textContent = ['Top left', 'Top right', 'Bottom right', 'Bottom left'][index]; const input = document.createElement('input'); input.type = 'number'; input.min = 0; input.value = dimensions[side] || 0; input.setAttribute('aria-label', label.textContent); label.appendChild(input); fields.appendChild(label); return input; });
        const commitAll = () => panel.setValue(control, node, { ...Object.fromEntries(sides.map((side) => [side, Math.max(0, Number(number.value) || 0)])), unit: unit.value, linked: true });
        commitOnFinish(number, commitAll);
        unit.addEventListener('change', () => panel.setValue(control, node, { ...dimensions, unit: unit.value }));
        individual.setAttribute('aria-expanded', String(!fields.hidden)); individual.addEventListener('click', () => { fields.hidden = !fields.hidden; individual.setAttribute('aria-expanded', String(!fields.hidden)); });
        inputs.forEach((input) => commitOnFinish(input, () => panel.setValue(control, node, { ...Object.fromEntries(sides.map((side, index) => [side, Math.max(0, Number(inputs[index].value) || 0)])), unit: unit.value, linked: false })));
        wrapper.append(number, unit, individual, fields); row.appendChild(wrapper); return row;
    }
    const inputs = document.createElement('div'); inputs.className = 'ink-v2-dimensions';
    let linked = dimensions.linked !== false;
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
        const field = document.createElement('label'); field.innerHTML = `<span>${side[0].toUpperCase()}</span>`;
        const input = document.createElement('input'); input.type = 'number'; input.value = dimensions[side] ?? '';
        field.prepend(input); inputs.appendChild(field);
    });
    const unit = document.createElement('select'); unit.className = 'ink-v2-unit';
    (control.units || ['px']).forEach((name) => { const option = document.createElement('option'); option.value = name; option.textContent = name; unit.appendChild(option); });
    unit.value = dimensions.unit || control.units?.[0] || 'px'; inputs.appendChild(unit);
    const link = document.createElement('button'); link.type = 'button'; link.className = 'ink-v2-link-values'; link.title = 'Link values'; link.setAttribute('aria-label', 'Link spacing values'); link.innerHTML = '<span class="material-symbols-rounded">link</span>'; link.classList.toggle('is-active', linked); inputs.appendChild(link);
    const commit = (source) => {
        const sides = inputs.querySelectorAll('input');
        if (linked && source) sides.forEach((input) => { if (input !== source) input.value = source.value; });
        panel.setValue(control, node, { top: Number(sides[0].value) || 0, right: Number(sides[1].value) || 0, bottom: Number(sides[2].value) || 0, left: Number(sides[3].value) || 0, unit: unit.value, linked });
    };
    inputs.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => commit(input))); unit.addEventListener('change', () => commit()); link.addEventListener('click', () => { linked = !linked; link.classList.toggle('is-active', linked); if (linked) commit(inputs.querySelector('input')); });
    row.appendChild(inputs); return row;
}

// Exact palette observed in the reference Figma file's "On this page" set.
const INK_COLOR_PALETTE = ['#64748B', '#FFFFFF', '#3B001B', '#FEFAE7', '#FFE878', '#C0ECBF', '#FF5A1F', '#0D1B2A', '#0A1128', '#1E293B', '#F8FAFC', '#E2E8F0', '#10B981', '#94A3B8', '#A855F7', '#5FFFCF', '#060A13', '#FFBD2E', '#FF5F56', '#27C93F', '#000000', '#F4F6F9', '#1E1E1E', '#1B263B'];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const colorChannels = (source) => {
    const text = String(source || '').trim();
    const rgba = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i.exec(text);
    if (rgba) return { r: clamp(rgba[1], 0, 255), g: clamp(rgba[2], 0, 255), b: clamp(rgba[3], 0, 255), a: clamp(rgba[4] === undefined ? 1 : rgba[4]) };
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
    if (hex) { let body = hex[1]; if (body.length === 3) body = [...body].map((char) => char + char).join(''); return { r: parseInt(body.slice(0, 2), 16), g: parseInt(body.slice(2, 4), 16), b: parseInt(body.slice(4, 6), 16), a: body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1 }; }
    return { r: 0, g: 0, b: 0, a: 1 };
};
const colorHex = ({ r, g, b }) => `#${[r, g, b].map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
const colorCss = (rgba) => rgba.a >= 0.999 ? colorHex(rgba) : `rgba(${Math.round(rgba.r)},${Math.round(rgba.g)},${Math.round(rgba.b)},${Number(rgba.a.toFixed(2))})`;
const projectPalette = (panel, selectedNode) => {
    const found = []; const seen = new Set();
    const add = (source) => {
        const text = String(source || '').trim();
        if (!/^(#[0-9a-f]{3,8}|rgba?\()/i.test(text)) return;
        const normalized = colorCss(colorChannels(text)); const key = normalized.toLowerCase();
        if (!seen.has(key)) { seen.add(key); found.push(normalized); }
    };
    const scan = (value) => {
        if (value === null || value === undefined) return;
        if (Array.isArray(value)) { value.forEach(scan); return; }
        if (typeof value === 'object') { Object.values(value).forEach(scan); return; }
        if (typeof value !== 'string') return;
        (value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || []).forEach(add);
    };
    // Selection colors lead, followed by the complete editable document and custom code.
    scan(selectedNode); scan(panel.runtime.document.data);
    const instances = panel.runtime.canvas?.instances;
    const selectedInstance = selectedNode && instances?.get(selectedNode.id);
    const ordered = [selectedInstance, ...[...(instances?.values?.() || [])]].filter(Boolean);
    ordered.slice(0, 80).forEach((instance) => {
        const element = instance.element; if (!element?.isConnected) return;
        const view = element.ownerDocument.defaultView;
        [element, ...element.querySelectorAll('*')].slice(0, 40).forEach((item) => {
            const style = view.getComputedStyle(item);
            ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'textDecorationColor'].forEach((name) => add(style[name]));
        });
    });
    return found;
};
const rgbToHsv = ({ r, g, b }) => { const rr = r / 255; const gg = g / 255; const bb = b / 255; const max = Math.max(rr, gg, bb); const min = Math.min(rr, gg, bb); const d = max - min; let h = 0; if (d) h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4; return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }; };
const hsvToRgb = ({ h, s, v, a = 1 }) => { const c = v * s; const x = c * (1 - Math.abs((h / 60) % 2 - 1)); const m = v - c; const parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return { r: (parts[0] + m) * 255, g: (parts[1] + m) * 255, b: (parts[2] + m) * 255, a }; };

function openColorStudio(anchor, source, onCommit, palette = INK_COLOR_PALETTE) {
    document.querySelector('.ink-v2-color-studio')?.remove();
    let rgba = colorChannels(source); let hsv = { ...rgbToHsv(rgba), a: rgba.a };
    const studio = document.createElement('div'); studio.className = 'ink-v2-color-studio'; studio.setAttribute('role', 'dialog'); studio.setAttribute('aria-label', 'Ink color studio');
    studio.innerHTML = '<div class="ink-v2-color-studio-head"><strong>Custom</strong><span>Libraries</span><button type="button" data-eyedropper aria-label="Pick a color from the page" title="Eyedropper">⌁</button><button type="button" data-close aria-label="Close color studio">×</button></div><div class="ink-v2-color-plane"><i></i></div><input class="ink-v2-hue" type="range" min="0" max="360" step="1" aria-label="Hue"><input class="ink-v2-alpha" type="range" min="0" max="100" step="1" aria-label="Opacity"><div class="ink-v2-color-fields"><select aria-label="Color format"><option>Hex</option><option>RGBA</option></select><input data-hex aria-label="Hex color"><input data-alpha type="number" min="0" max="100" aria-label="Opacity percent"><span>%</span></div><label class="ink-v2-palette-label">On this page</label><div class="ink-v2-color-palette"></div>';
    const plane = studio.querySelector('.ink-v2-color-plane'); const indicator = plane.querySelector('i'); const hue = studio.querySelector('.ink-v2-hue'); const alpha = studio.querySelector('.ink-v2-alpha'); const hex = studio.querySelector('[data-hex]'); const alphaNumber = studio.querySelector('[data-alpha]');
    const sync = () => { rgba = hsvToRgb(hsv); const hexValue = colorHex(rgba).slice(1).toUpperCase(); plane.style.setProperty('--ink-picker-hue', `hsl(${hsv.h} 100% 50%)`); indicator.style.left = `${hsv.s * 100}%`; indicator.style.top = `${(1 - hsv.v) * 100}%`; indicator.style.setProperty('--ink-picker-color', colorCss(rgba)); hue.value = hsv.h; alpha.value = hsv.a * 100; alpha.style.setProperty('--ink-alpha-color', colorHex(rgba)); hex.value = hexValue; alphaNumber.value = Math.round(hsv.a * 100); anchor.style.setProperty('--ink-current-color', colorCss(rgba)); };
    const outside = (event) => {
        if (!studio.contains(event.target) && !anchor.contains(event.target)) {
            document.removeEventListener('pointerdown', outside);
            studio.remove();
        }
    };
    const finish = () => { document.removeEventListener('pointerdown', outside); onCommit(colorCss(rgba)); studio.remove(); };
    const setPlane = (event) => { const rect = plane.getBoundingClientRect(); hsv.s = clamp((event.clientX - rect.left) / rect.width); hsv.v = 1 - clamp((event.clientY - rect.top) / rect.height); sync(); };
    plane.addEventListener('pointerdown', (event) => { plane.setPointerCapture(event.pointerId); setPlane(event); const move = (next) => setPlane(next); const up = () => { plane.removeEventListener('pointermove', move); finish(); }; plane.addEventListener('pointermove', move); plane.addEventListener('pointerup', up, { once: true }); });
    hue.addEventListener('input', () => { hsv.h = Number(hue.value); sync(); }); hue.addEventListener('change', finish);
    alpha.addEventListener('input', () => { hsv.a = Number(alpha.value) / 100; sync(); }); alpha.addEventListener('change', finish);
    hex.addEventListener('change', () => { const next = colorChannels(`#${hex.value.replace('#', '')}`); hsv = { ...rgbToHsv(next), a: Number(alphaNumber.value) / 100 }; sync(); finish(); });
    alphaNumber.addEventListener('change', () => { hsv.a = Number(alphaNumber.value) / 100; sync(); finish(); });
    const paletteHost = studio.querySelector('.ink-v2-color-palette'); [...new Set(palette)].forEach((item) => { const swatch = document.createElement('button'); swatch.type = 'button'; swatch.title = item; swatch.setAttribute('aria-label', `Use ${item}`); swatch.style.setProperty('--swatch', item); swatch.addEventListener('click', () => { rgba = colorChannels(item); hsv = { ...rgbToHsv(rgba), a: rgba.a }; sync(); finish(); }); paletteHost.appendChild(swatch); });
    const eyeDropper = studio.querySelector('[data-eyedropper]'); eyeDropper.hidden = !window.EyeDropper;
    eyeDropper.addEventListener('click', async () => { try { const result = await new window.EyeDropper().open(); rgba = colorChannels(result.sRGBHex); hsv = { ...rgbToHsv(rgba), a: hsv.a }; sync(); finish(); } catch (_) { /* User cancelled the native picker. */ } });
    studio.querySelector('[data-close]').addEventListener('click', () => { document.removeEventListener('pointerdown', outside); studio.remove(); });
    document.body.appendChild(studio); const rect = anchor.getBoundingClientRect(); const width = studio.offsetWidth; studio.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, rect.right - width))}px`; studio.style.top = `${Math.max(8, Math.min(innerHeight - studio.offsetHeight - 8, rect.bottom + 8))}px`; sync();
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
}

function colorTrigger(source, onCommit, palette) {
    const rgba = colorChannels(source); const button = document.createElement('button'); button.type = 'button'; button.className = 'ink-v2-color-trigger'; button.style.setProperty('--ink-current-color', colorCss(rgba)); button.innerHTML = `<span></span><code>${colorHex(rgba).slice(1).toUpperCase()}</code><em>${Math.round(rgba.a * 100)}%</em>`; button.addEventListener('click', () => openColorStudio(button, colorCss(rgba), onCommit, palette)); return button;
}

export function color(panel, control, node, value, row) {
    const globals = panel.runtime.document.data.settings.theme?.colors || {};
    const resolved = /^var\(--ink-color-([^)]+)\)$/.exec(String(value || ''));
    const current = resolved ? globals[resolved[1]] || '#000000' : value || '#000000';
    const palette = [...projectPalette(panel, node), ...Object.values(globals), ...INK_COLOR_PALETTE];
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-color-control'; wrapper.appendChild(colorTrigger(current, (next) => panel.setValue(control, node, next), palette)); row.appendChild(wrapper); return row;
}

export function cssFilters(panel, control, node, value, row) {
    const filters = value && typeof value === 'object' ? value : {};
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-css-filters';
    const read = () => Object.fromEntries([...wrapper.querySelectorAll('[data-filter]')].map((input) => [input.dataset.filter, Number(input.value)]));
    const definitions = [['blur', 0, 20, 1], ['brightness', 0, 200, 5], ['contrast', 0, 200, 5], ['saturate', 0, 200, 5], ['hue', 0, 360, 5]];
    const add = document.createElement('select'); add.setAttribute('aria-label', 'Add filter'); add.add(new Option('Add filter…', ''));
    definitions.filter(([name]) => filters[name] === undefined).forEach(([name]) => add.add(new Option(name[0].toUpperCase() + name.slice(1), name)));
    add.disabled = add.options.length === 1;
    add.addEventListener('change', () => { if (add.value) panel.setValue(control, node, { ...filters, [add.value]: ['blur', 'hue'].includes(add.value) ? 0 : 100 }); });
    wrapper.appendChild(add);
    definitions.filter(([name]) => filters[name] !== undefined).forEach(([name, min, max, step]) => {
        const label = document.createElement('label'); label.textContent = name;
        const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step;
        input.value = filters[name] ?? (name === 'blur' || name === 'hue' ? 0 : 100); input.dataset.filter = name;
        input.setAttribute('aria-label', `${name} filter`);
        const number = document.createElement('input'); number.type = 'number'; number.min = min; number.max = max; number.step = step; number.value = input.value;
        number.setAttribute('aria-label', `${name} value`); number.title = name === 'blur' ? 'Pixels' : name === 'hue' ? 'Degrees' : 'Percent';
        const scrub = (finish) => { number.value = input.value; panel.scrubValue(control, node, read(), finish); };
        input.addEventListener('input', () => scrub(false)); input.addEventListener('change', () => scrub(true));
        input.addEventListener('blur', () => { if (panel.scrubbing) scrub(true); });
        commitOnFinish(number, () => { input.value = number.value; panel.setValue(control, node, read()); });
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${name} filter`);
        remove.addEventListener('click', () => { const next = { ...filters }; delete next[name]; panel.setValue(control, node, next); });
        label.append(input, number, remove); wrapper.appendChild(label);
    });
    row.appendChild(wrapper); return row;
}

export function textStroke(panel, control, node, value, row) {
    const stroke = value && typeof value === 'object' ? value : {}; const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-text-stroke';
    const width = document.createElement('input'); width.type = 'number'; width.min = 0; width.value = stroke.strokeWidth ?? 0; let strokeColor = stroke.color || '#000000';
    const globals = panel.runtime.document.data.settings.theme?.colors || {};
    const commit = () => panel.setValue(control, node, { strokeWidth: Number(width.value) || 0, unit: 'px', color: strokeColor });
    const trigger = colorTrigger(strokeColor, (next) => { strokeColor = next; commit(); }, [...projectPalette(panel, node), ...Object.values(globals), ...INK_COLOR_PALETTE]); width.addEventListener('change', commit); wrapper.append(width, trigger); row.appendChild(wrapper); return row;
}

export function gradient(panel, control, node, value, row) {
    const split = (source) => { const parts = []; let depth = 0; let start = 0; [...source].forEach((char, index) => { if (char === '(') depth += 1; if (char === ')') depth -= 1; if (char === ',' && depth === 0) { parts.push(source.slice(start, index).trim()); start = index + 1; } }); parts.push(source.slice(start).trim()); return parts.filter(Boolean); };
    const color = (source) => { const channels = colorChannels(source); return { hex: colorHex(channels), alpha: Math.round(channels.a * 100) }; };
    const parsed = (() => {
        const match = /^linear-gradient\((.*)\)$/i.exec(String(value || '').trim());
        if (!match) return { angle: 90, stops: [{ color: '#6ec1e4', alpha: 100, position: 0 }, { color: '#4054b2', alpha: 100, position: 100 }] };
        const parts = split(match[1]); const anglePart = /^(-?\d+(?:\.\d+)?)deg$/i.exec(parts[0]);
        const stopParts = anglePart ? parts.slice(1) : parts; const count = Math.max(1, stopParts.length - 1);
        return { angle: anglePart ? Number(anglePart[1]) : 90, stops: stopParts.map((part, index) => { const position = /\s+(-?\d+(?:\.\d+)?)%\s*$/.exec(part); const rawColor = position ? part.slice(0, position.index).trim() : part; const parsedColor = color(rawColor); return { color: parsedColor.hex, alpha: parsedColor.alpha, position: position ? Number(position[1]) : Math.round(index / count * 100) }; }) };
    })();
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gradient';
    const globals = panel.runtime.document.data.settings.theme?.colors || {};
    const palette = [...projectPalette(panel, node), ...Object.values(globals), ...INK_COLOR_PALETTE];
    const toolbar = document.createElement('div'); toolbar.className = 'ink-v2-gradient-toolbar';
    const kind = document.createElement('select'); kind.setAttribute('aria-label', 'Gradient type'); kind.add(new Option('Linear', 'linear')); kind.value = 'linear';
    const angleRow = document.createElement('label'); angleRow.className = 'ink-v2-gradient-angle'; angleRow.title = 'Gradient angle'; angleRow.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M7 4h5v5"/></svg>';
    const angle = document.createElement('input'); angle.type = 'number'; angle.min = 0; angle.max = 360; angle.value = parsed.angle; angle.setAttribute('aria-label', 'Gradient angle'); const degrees = document.createElement('span'); degrees.textContent = '°'; angleRow.append(angle, degrees);
    const reverse = document.createElement('button'); reverse.type = 'button'; reverse.className = 'ink-v2-gradient-reverse'; reverse.title = 'Reverse gradient'; reverse.setAttribute('aria-label', reverse.title); reverse.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h10m0 0-2-2m2 2-2 2M13 11H3m0 0 2-2m-2 2 2 2"/></svg>';
    toolbar.append(kind, reverse, angleRow); wrapper.appendChild(toolbar);
    const cssColor = (stop) => stop.alpha >= 100 ? stop.color : `rgba(${[1, 3, 5].map((offset) => parseInt(stop.color.slice(offset, offset + 2), 16)).join(',')},${Math.max(0, Math.min(100, stop.alpha)) / 100})`;
    const commit = (stops = parsed.stops) => panel.setValue(control, node, `linear-gradient(${Number(angle.value) || 0}deg, ${stops.map((stop) => `${cssColor(stop)} ${Number(stop.position) || 0}%`).join(', ')})`);
    angle.addEventListener('change', () => commit());
    const rail = document.createElement('div'); rail.className = 'ink-v2-gradient-rail'; rail.style.background = `linear-gradient(${parsed.angle}deg, ${parsed.stops.map((stop) => `${cssColor(stop)} ${stop.position}%`).join(', ')})`;
    rail.title = 'Double-click to add a gradient stop';
    rail.addEventListener('dblclick', (event) => { const rect = rail.getBoundingClientRect(); const position = Math.round(clamp((event.clientX - rect.left) / rect.width) * 100); commit([...parsed.stops, { color: '#ffffff', alpha: 100, position }].sort((a, b) => a.position - b.position)); });
    parsed.stops.forEach((stop) => { const marker = document.createElement('button'); marker.type = 'button'; marker.className = 'ink-v2-gradient-marker'; marker.style.left = `${stop.position}%`; marker.style.setProperty('--ink-current-color', cssColor(stop)); marker.title = `Edit stop at ${stop.position}%`; marker.addEventListener('click', () => openColorStudio(marker, cssColor(stop), (next) => { const channels = colorChannels(next); stop.color = colorHex(channels); stop.alpha = Math.round(channels.a * 100); commit(); }, palette)); rail.appendChild(marker); });
    wrapper.appendChild(rail);
    reverse.addEventListener('click', () => commit(parsed.stops.map((stop) => ({ ...stop, position: 100 - Number(stop.position) })).reverse()));
    const stops = document.createElement('div'); stops.className = 'ink-v2-gradient-stops';
    const stopsHeader = document.createElement('div'); stopsHeader.className = 'ink-v2-gradient-stops-head'; stopsHeader.append('Stops');
    const add = document.createElement('button'); add.type = 'button'; add.title = 'Add gradient stop'; add.setAttribute('aria-label', add.title); add.textContent = '+'; add.addEventListener('click', () => commit([...parsed.stops, { color: '#ffffff', alpha: 100, position: 50 }].sort((a, b) => a.position - b.position))); stopsHeader.appendChild(add); stops.appendChild(stopsHeader);
    parsed.stops.forEach((stop, index) => {
        const stopRow = document.createElement('div'); stopRow.className = 'ink-v2-gradient-stop';
        const trigger = colorTrigger(cssColor(stop), (next) => { const channels = colorChannels(next); stop.color = colorHex(channels); stop.alpha = Math.round(channels.a * 100); commit(); }, palette);
        const positionField = document.createElement('label'); positionField.className = 'ink-v2-gradient-position';
        const position = document.createElement('input'); position.type = 'number'; position.min = 0; position.max = 100; position.title = 'Position (%)'; position.setAttribute('aria-label', position.title); position.value = stop.position; const percent = document.createElement('span'); percent.textContent = '%'; positionField.append(position, percent);
        const alphaField = document.createElement('label'); alphaField.className = 'ink-v2-gradient-alpha'; const alpha = document.createElement('input'); alpha.type = 'number'; alpha.min = 0; alpha.max = 100; alpha.value = stop.alpha; alpha.setAttribute('aria-label', 'Stop opacity (%)'); const alphaPercent = document.createElement('span'); alphaPercent.textContent = '%'; alphaField.append(alpha, alphaPercent);
        const remove = document.createElement('button'); remove.type = 'button'; remove.title = 'Remove stop'; remove.setAttribute('aria-label', 'Remove gradient stop'); remove.textContent = '×'; remove.disabled = parsed.stops.length <= 2;
        position.addEventListener('change', () => { stop.position = Number(position.value); commit(); });
        alpha.addEventListener('change', () => { stop.alpha = Math.max(0, Math.min(100, Number(alpha.value) || 0)); commit(); });
        remove.addEventListener('click', () => commit(parsed.stops.filter((_, cursor) => cursor !== index)));
        stopRow.append(positionField, trigger, alphaField, remove); stops.appendChild(stopRow);
    });
    wrapper.appendChild(stops); row.appendChild(wrapper); return row;
}

/* ------------------------------------------------------------------ *
 * Media / gallery / dimensions / url / icon
 * ------------------------------------------------------------------ */

export function media(panel, control, node, value, row) {
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-media';
    const url = typeof value === 'object' ? value?.url || '' : value || '';
    const preview = document.createElement('div'); preview.className = 'ink-v2-media-preview';
    if (/^linear-gradient\(/.test(url) || /^radial-gradient\(/.test(url)) { preview.style.background = url; preview.style.backgroundSize = 'cover'; preview.innerHTML = '<span>Gradient background</span>'; }
    else if (url && /\.(mp4|webm|ogg)(\?|$)/i.test(url)) { const video = document.createElement('video'); video.src = url; video.muted = true; preview.appendChild(video); }
    else if (url) { const image = document.createElement('img'); image.src = url; image.alt = ''; preview.appendChild(image); }
    else preview.innerHTML = '<span>No media selected</span>';
    const actions = document.createElement('div'); actions.className = 'ink-v2-media-actions';
    const mediaValue = (current, next) => current && typeof current === 'object' && !Array.isArray(current) ? { ...current, url: next } : next;
    const library = document.createElement('button'); library.type = 'button'; library.textContent = 'Choose'; library.addEventListener('click', () => pickMedia((next) => panel.setValue(control, node, mediaValue(value, next))));
    const upload = document.createElement('button'); upload.type = 'button'; upload.textContent = 'Upload'; upload.addEventListener('click', () => uploadMedia(panel.runtime.assetUploadHandler, control.accept, (next) => panel.setValue(control, node, mediaValue(value, next))));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.disabled = !url; remove.addEventListener('click', () => panel.setValue(control, node, mediaValue(value, '')));
    actions.append(library, upload, remove); wrapper.append(preview, actions); row.appendChild(wrapper); return row;
}

// Imported sites often implement a section background as a positioned image layer rather
// than CSS background-image. This control edits that native image node from the owning
// section, preserving the captured wrapper, mask, blend mode, and positioning rules.
export function importedBackground(panel, control, node, value, row) {
    const imageNode = panel.runtime.document.get(value);
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-media';
    const current = imageNode?.settings?.src || imageNode?.settings?.importedAttributes?.src || '';
    const currentUrl = typeof current === 'object' ? current.url || '' : current;
    const preview = document.createElement('div'); preview.className = 'ink-v2-media-preview';
    if (currentUrl) { const image = document.createElement('img'); image.src = currentUrl; image.alt = ''; preview.appendChild(image); }
    else preview.innerHTML = '<span>Imported image unavailable</span>';

    const replace = (next) => {
        if (!imageNode) return;
        const attributes = { ...(imageNode.settings.importedAttributes || {}) };
        if (next) attributes.src = next; else delete attributes.src;
        // Responsive candidates from the captured site would otherwise keep winning over
        // the newly selected source in the browser's image selection algorithm.
        delete attributes.srcset;
        delete attributes.sizes;
        panel.runtime.update(imageNode.id, { settings: { src: next, importedAttributes: attributes } }, 'Change imported background image');
    };

    const actions = document.createElement('div'); actions.className = 'ink-v2-media-actions';
    const library = document.createElement('button'); library.type = 'button'; library.textContent = 'Choose'; library.disabled = !imageNode; library.addEventListener('click', () => pickMedia(replace));
    const upload = document.createElement('button'); upload.type = 'button'; upload.textContent = 'Upload'; upload.disabled = !imageNode; upload.addEventListener('click', () => uploadMedia(panel.runtime.assetUploadHandler, 'image/*', replace));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.disabled = !imageNode || !currentUrl; remove.addEventListener('click', () => replace(''));
    actions.append(library, upload, remove); wrapper.append(preview, actions); row.appendChild(wrapper); return row;
}

export function gallery(panel, control, node, value, row) {
    const images = Array.isArray(value) ? value : [];
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gallery';
    const thumbnails = document.createElement('div'); thumbnails.className = 'ink-v2-gallery-thumbnails';
    images.forEach((item, index) => {
        const tile = document.createElement('button'); tile.type = 'button'; tile.title = 'Remove image';
        const image = document.createElement('img'); image.src = typeof item === 'string' ? item : item.url; image.alt = ''; tile.appendChild(image);
        tile.addEventListener('click', () => panel.setValue(control, node, images.filter((_, cursor) => cursor !== index))); thumbnails.appendChild(tile);
    });
    const actions = document.createElement('div'); actions.className = 'ink-v2-media-actions';
    const add = document.createElement('button'); add.type = 'button'; add.textContent = 'Add images'; add.addEventListener('click', () => pickMedia((url) => panel.setValue(control, node, [...images, { url }])));
    const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Clear'; clear.disabled = !images.length; clear.addEventListener('click', () => panel.setValue(control, node, []));
    actions.append(add, clear); wrapper.append(thumbnails, actions); row.appendChild(wrapper); return row;
}

export function imageDimensions(panel, control, node, value, row) {
    const dimensions = value && typeof value === 'object' ? value : {};
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-image-dimensions';
    const width = document.createElement('input'); width.type = 'number'; width.placeholder = 'Width'; width.value = dimensions.width ?? '';
    const height = document.createElement('input'); height.type = 'number'; height.placeholder = 'Height'; height.value = dimensions.height ?? '';
    const unit = document.createElement('select'); (control.units || ['px', '%']).forEach((name) => unit.add(new Option(name, name))); unit.value = dimensions.unit || control.units?.[0] || 'px';
    const commit = () => panel.setValue(control, node, { width: Number(width.value) || 0, height: Number(height.value) || 0, unit: unit.value });
    [width, height, unit].forEach((input) => input.addEventListener('change', commit)); wrapper.append(width, height, unit); row.appendChild(wrapper); return row;
}

export function url(panel, control, node, value, row) {
    const link = value && typeof value === 'object' ? value : { url: value || '' };
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-url';
    const input = document.createElement('input'); input.type = 'url'; input.placeholder = 'https://'; input.value = link.url || '';
    const options = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '⚙'; options.appendChild(summary);
    [['isExternal', 'Open in new window'], ['nofollow', 'Add nofollow']].forEach(([name, text]) => { const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!link[name]; checkbox.dataset.urlOption = name; label.append(checkbox, text); options.appendChild(label); });
    const attributes = document.createElement('input'); attributes.type = 'text'; attributes.placeholder = 'key|value, key|value'; attributes.value = link.customAttributes || ''; attributes.dataset.urlAttributes = ''; options.appendChild(attributes);
    const commit = () => { const next = { url: input.value, customAttributes: attributes.value }; options.querySelectorAll('[data-url-option]').forEach((checkbox) => { next[checkbox.dataset.urlOption] = checkbox.checked; }); panel.setValue(control, node, control.multiple || typeof value === 'object' ? next : next.url); };
    commitOnFinish(input, commit); options.querySelectorAll('input').forEach((field) => commitOnFinish(field, commit)); wrapper.append(input, options); row.appendChild(wrapper); return row;
}

export function icon(panel, control, node, value, row) {
    row.classList.add('ink-v2-icons');
    const resolved = resolveIcon(value);
    const libraries = ['material', 'phosphor', 'lucide'];
    const tabs = document.createElement('div'); tabs.className = 'ink-v2-icon-libs';
    let active = libraries.includes(resolved.library) ? resolved.library : 'material';
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search icons'; search.className = 'ink-v2-icon-search';
    const grid = document.createElement('div'); grid.className = 'ink-v2-icon-grid';
    const draw = () => {
        grid.replaceChildren();
        const all = iconNames(active);
        const query = search.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
        const shown = query ? all.filter((name) => name.includes(query)) : all;
        if (!shown.length) { grid.innerHTML = '<span class="ink-v2-icon-empty">No icons match</span>'; return; }
        const fragment = document.createDocumentFragment();
        shown.forEach((name) => {
            const button = document.createElement('button'); button.type = 'button'; button.title = name; button.className = resolved.library === active && resolved.name === name ? 'is-active' : '';
            button.setAttribute('aria-label', name);
            button.appendChild(renderIcon(document, iconValue(active, name)));
            button.addEventListener('click', () => panel.setValue(control, node, iconValue(active, name)));
            fragment.appendChild(button);
        });
        grid.appendChild(fragment);
    };
    libraries.forEach((library) => {
        const tab = document.createElement('button'); tab.type = 'button'; tab.textContent = `${libraryTitle(library)} · ${iconCount(library)}`; tab.className = library === active ? 'is-active' : '';
        tab.addEventListener('click', () => { active = library; tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === tab)); draw(); });
        tabs.appendChild(tab);
    });
    search.addEventListener('input', draw);
    draw();
    const custom = document.createElement('input'); custom.type = 'text'; custom.placeholder = 'Icon name (material) or lucide:name'; custom.value = typeof value === 'string' ? value : ''; custom.addEventListener('change', () => panel.setValue(control, node, custom.value));
    row.append(tabs, search, grid, custom); return row;
}

/* ------------------------------------------------------------------ *
 * Shadow / border / repeater
 * ------------------------------------------------------------------ */

export function shadow(panel, control, node, value, row) {
    const shadows = Array.isArray(value) ? value : (value && typeof value === 'object' ? [value] : []);
    const enabled = shadows.length > 0;
    const controlHost = document.createElement('div'); controlHost.className = 'ink-v2-shadow-control';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'ink-v2-shadow-toggle'; toggle.title = enabled ? 'Remove shadows' : 'Add shadow'; toggle.setAttribute('aria-label', toggle.title);
    toggle.innerHTML = `<span class="material-symbols-rounded">${enabled ? 'close' : 'edit'}</span>`;
    toggle.addEventListener('click', () => panel.setValue(control, node, enabled ? '' : { x: 0, y: 0, blur: 10, spread: 0, unit: 'px', color: '#000000', inset: false }));
    controlHost.appendChild(toggle);
    if (!enabled) { row.appendChild(controlHost); return row; }
    const layers = document.createElement('div'); layers.className = 'ink-v2-shadow-layers';
    const save = (next) => panel.setValue(control, node, next.length === 1 ? next[0] : next);
    shadows.forEach((shadow, index) => {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-shadow';
        const heading = document.createElement('div'); heading.className = 'ink-v2-shadow-heading'; heading.textContent = shadows.length > 1 ? `Shadow ${index + 1}` : 'Shadow';
        const remove = document.createElement('button'); remove.type = 'button'; remove.title = 'Remove shadow'; remove.setAttribute('aria-label', remove.title); remove.textContent = '×';
        remove.addEventListener('click', () => save(shadows.filter((_, cursor) => cursor !== index)));
        heading.appendChild(remove); wrapper.appendChild(heading);
        ['x', 'y', 'blur', ...(control.type === 'box-shadow' ? ['spread'] : [])].forEach((name) => {
            const field = document.createElement('label'); field.textContent = name;
            const input = document.createElement('input'); input.type = 'number'; input.value = shadow[name] ?? 0; input.dataset.shadowField = name; field.prepend(input); wrapper.appendChild(field);
        });
        let shadowColor = shadow.color || 'rgba(0,0,0,.25)';
        const commit = () => {
            const nextShadow = { unit: shadow.unit || 'px', color: shadowColor };
            wrapper.querySelectorAll('[data-shadow-field]').forEach((input) => { nextShadow[input.dataset.shadowField] = Number(input.value); });
            nextShadow.inset = wrapper.querySelector('[data-shadow-position]')?.value === 'inset';
            const next = structuredClone(shadows); next[index] = nextShadow; save(next);
        };
        const colorField = document.createElement('label'); colorField.className = 'ink-v2-shadow-color'; colorField.textContent = 'Color';
        const globals = panel.runtime.document.data.settings.theme?.colors || {};
        const colorButton = colorTrigger(shadowColor, (next) => { shadowColor = next; commit(); }, [...Object.values(globals), ...INK_COLOR_PALETTE]); colorField.prepend(colorButton); wrapper.appendChild(colorField);
        if (control.type === 'box-shadow') {
            const position = document.createElement('label'); position.className = 'ink-v2-shadow-position'; position.textContent = 'Position';
            const select = document.createElement('select'); select.dataset.shadowPosition = ''; select.add(new Option('Outline', 'outline')); select.add(new Option('Inset', 'inset')); select.value = shadow.inset ? 'inset' : 'outline'; position.prepend(select); wrapper.appendChild(position);
        }
        wrapper.querySelectorAll('input, select').forEach((input) => input.addEventListener('change', commit)); layers.appendChild(wrapper);
    });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'ink-v2-shadow-add'; add.textContent = '+ Add shadow';
    add.addEventListener('click', () => save([...shadows, { x: 0, y: 4, blur: 12, spread: 0, unit: 'px', color: 'rgba(0,0,0,.25)', inset: false }]));
    layers.appendChild(add); controlHost.appendChild(layers); row.appendChild(controlHost); return row;
}

export function border(panel, control, node, value, row) {
    row.classList.add('ink-v2-control-group');
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-border';
    const styleControl = { ...control, name: 'border-style', type: 'select' };
    const legacy = value && typeof value === 'object' ? value : {};
    const current = panel.currentValue(styleControl, node) || legacy.style || '';
    const style = document.createElement('select');
    [["", 'Default'], ['none', 'None'], ['solid', 'Solid'], ['double', 'Double'], ['dotted', 'Dotted'], ['dashed', 'Dashed'], ['groove', 'Groove']].forEach(([name, label]) => style.add(new Option(label, name)));
    style.value = current; style.addEventListener('change', () => panel.setValue(styleControl, node, style.value)); wrapper.appendChild(style);
    if (current && current !== 'none') {
        const nested = document.createElement('div'); nested.className = 'ink-v2-border-fields';
        nested.appendChild(panel.renderControl({ ...control, name: 'border-width', type: 'dimensions', label: 'Border Width', units: ['px', 'em', 'rem', 'vw'], responsive: true }, node));
        nested.appendChild(panel.renderControl({ ...control, name: 'border-color', type: 'color', label: 'Border Color' }, node));
        wrapper.appendChild(nested);
    }
    if (control.state === 'hover') {
        wrapper.appendChild(panel.renderControl({ ...control, state: 'base', name: 'border-transition-duration', type: 'slider', label: 'Transition Duration', min: 0, max: 3, step: 0.1, default: 0.3 }, node));
    }
    row.appendChild(wrapper); return row;
}

export function repeater(panel, control, node, value, row) {
    const items = Array.isArray(value) ? value : [];
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-repeater';
    const update = (next) => panel.setValue(control, node, next);
    items.forEach((item, index) => {
        const details = document.createElement('details'); details.open = index === 0;
        const summary = document.createElement('summary'); summary.innerHTML = `<span>⋮⋮</span><strong>${item[control.titleField] || item.title || `Item ${index + 1}`}</strong>`;
        const tools = document.createElement('span'); tools.className = 'ink-v2-repeater-tools';
        [['↑', -1], ['↓', 1]].forEach(([label, direction]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = index + direction < 0 || index + direction >= items.length; button.addEventListener('click', (event) => { event.preventDefault(); const next = [...items]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; update(next); }); tools.appendChild(button); });
        const duplicate = document.createElement('button'); duplicate.type = 'button'; duplicate.textContent = '⧉'; duplicate.addEventListener('click', (event) => { event.preventDefault(); const next = [...items]; next.splice(index + 1, 0, structuredClone(item)); update(next); });
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.disabled = items.length <= (control.minItems || 0); remove.addEventListener('click', (event) => { event.preventDefault(); update(items.filter((_, cursor) => cursor !== index)); }); tools.append(duplicate, remove); summary.appendChild(tools); details.appendChild(summary);
        const fields = document.createElement('div'); fields.className = 'ink-v2-repeater-fields';
        (control.fields || []).forEach((field) => {
            const label = document.createElement('label'); label.textContent = field.label || field.name; let input;
            if (field.type === 'select') { input = document.createElement('select'); (field.options || []).forEach((option) => input.add(new Option(labelFor(option), valueFor(option)))); }
            else { input = document.createElement(field.type === 'textarea' ? 'textarea' : 'input'); if (input.tagName === 'INPUT') input.type = field.type === 'number' ? 'number' : 'text'; }
            input.value = item[field.name] ?? field.default ?? ''; input.addEventListener('change', () => { const next = structuredClone(items); next[index][field.name] = field.type === 'number' ? Number(input.value) : input.value; update(next); }); label.appendChild(input); fields.appendChild(label);
        });
        details.appendChild(fields); wrapper.appendChild(details);
    });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'ink-v2-repeater-add'; add.textContent = '+ Add item'; add.disabled = !!control.maxItems && items.length >= control.maxItems;
    add.addEventListener('click', () => { const item = {}; (control.fields || []).forEach((field) => { item[field.name] = field.default ?? ''; }); update([...items, item]); }); wrapper.appendChild(add); row.appendChild(wrapper); return row;
}

/* ------------------------------------------------------------------ *
 * Surface controls (background / typography / structure / notices / wysiwyg)
 * ------------------------------------------------------------------ */

export function background(panel, control, node, value, row) {
    row.classList.add('ink-v2-control-group');
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-background';
    const overlay = control.part === 'overlay';
    const prefix = overlay ? 'overlay-' : '';
    const modeControl = { ...control, name: overlay ? '--ink-overlay-background-type' : '--ink-background-type', type: 'text' };
    const styleValue = (name) => panel.currentValue({ ...control, name }, node);
    const settingValue = (name) => panel.currentValue({ ...control, target: 'settings', part: undefined, name }, node);
    let mode = panel.currentValue(modeControl, node);
    // Older, imported, and programmatically composed documents may already contain a
    // complete background without the newer mode marker. The panel must describe what
    // is actually rendered instead of presenting every type as inactive.
    if (!mode && !overlay) {
        const video = node.settings?.backgroundVideo;
        const slideshow = node.settings?.backgroundSlideshow;
        if (video?.url || video?.fallback || settingValue('backgroundVideoUrl') || settingValue('backgroundVideoFallback')) mode = 'video';
        else if ((Array.isArray(slideshow?.images) && slideshow.images.length) || (Array.isArray(settingValue('backgroundSlideshowImages')) && settingValue('backgroundSlideshowImages').length)) mode = 'slideshow';
    }
    if (!mode) {
        const image = styleValue(`${prefix}background-image`);
        const imageValue = typeof image === 'object' ? image?.url : image;
        if (/^(linear|radial|conic)-gradient\(/i.test(String(imageValue || '').trim())) mode = 'gradient';
        else if (imageValue) mode = 'image';
        else if (styleValue(`${prefix}background-color`)) mode = 'classic';
    }
    if (!overlay && node.settings.shaderFill?.enabled) mode = 'shader';
    const displayedMode = mode;
    mode ||= 'classic';
    const typeRow = document.createElement('div'); typeRow.className = 'ink-v2-background-type';
    const label = document.createElement('span'); label.textContent = 'Fill type';
    const choices = document.createElement('div'); choices.className = 'ink-v2-background-choices'; choices.setAttribute('role', 'radiogroup'); choices.setAttribute('aria-label', overlay ? 'Overlay fill type' : 'Fill type');
    const backgroundChoices = [
        ['classic', 'square', 'Solid'],
        ['gradient', 'blend', 'Gradient'],
        ['image', 'image', 'Image'],
        ['pattern', 'grid-2x2', 'Pattern'],
    ];
    if (!overlay && (control.state || 'base') === 'base') backgroundChoices.push(['video', 'square-play', 'Video'], ['slideshow', 'images', 'Slideshow'], ['shader', 'waves', 'Shader']);
    backgroundChoices.forEach(([choiceValue, iconName, title]) => {
        const button = document.createElement('button'); button.type = 'button'; button.title = title; button.setAttribute('aria-label', title); button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', mode === choiceValue ? 'true' : 'false'); button.setAttribute('aria-pressed', mode === choiceValue ? 'true' : 'false'); button.classList.toggle('is-active', mode === choiceValue);
        button.appendChild(renderIcon(document, `lucide:${iconName}`, 'ink-v2-background-choice-icon'));
        button.addEventListener('click', () => {
            panel.runtime.history.begin('Change fill type');
            try {
                if (!overlay) panel.runtime.update(node.id, { settings: { shaderFill: { ...normalizeShader(node.settings.shaderFill), enabled: choiceValue === 'shader' }, ...(choiceValue !== 'video' ? { backgroundVideo: null, backgroundVideoUrl: '', backgroundVideoFallback: '' } : {}), ...(choiceValue !== 'slideshow' ? { backgroundSlideshow: null, backgroundSlideshowImages: [] } : {}) } }, 'Change fill');
                if (choiceValue === 'classic' || choiceValue === 'image') panel.setValue({ ...control, name: `${prefix}background-image` }, node, '');
                if (choiceValue === 'gradient') panel.setValue({ ...control, name: `${prefix}background-image` }, node, 'linear-gradient(135deg, #8369d8 0%, #8fe3c5 100%)');
                panel.setValue(modeControl, node, choiceValue);
                panel.runtime.history.commit();
            } catch (error) { panel.runtime.history.rollback(); throw error; }
        });
        choices.appendChild(button);
    });
    typeRow.append(label, choices); wrapper.appendChild(typeRow);
    const sub = (partial) => panel.renderControl({ tab: control.tab, target: control.target, section: control.section, state: control.state, part: control.part, ...partial }, node);
    const settingSub = (partial) => panel.renderControl({ tab: control.tab, target: 'settings', section: control.section, ...partial }, node);
    if (mode === 'classic' || mode === 'image') {
        wrapper.appendChild(sub({ name: `${prefix}background-color`, type: 'color', label: 'Color' }));
        if (mode === 'image') wrapper.appendChild(sub({ name: `${prefix}background-image`, type: 'media', label: 'Image' }));
        if (panel.currentValue({ ...control, name: `${prefix}background-image` }, node)) {
            wrapper.appendChild(sub({ name: `${prefix}background-position`, type: 'select', label: 'Position', options: ['center center', 'center top', 'center bottom', 'left top', 'left center', 'left bottom', 'right top', 'right center', 'right bottom'] }));
            wrapper.appendChild(sub({ name: `${prefix}background-attachment`, type: 'select', label: 'Attachment', options: ['scroll', 'fixed', 'local'] }));
            wrapper.appendChild(sub({ name: `${prefix}background-repeat`, type: 'select', label: 'Repeat', options: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] }));
            wrapper.appendChild(sub({ name: `${prefix}background-size`, type: 'select', label: 'Size', options: ['auto', 'cover', 'contain'] }));
        }
    } else if (mode === 'gradient') {
        wrapper.appendChild(sub({ name: `${prefix}background-image`, type: 'gradient', label: 'Gradient' }));
    } else if (mode === 'pattern') {
        const patterns = [
            ['Dots', 'radial-gradient(circle, #81818a 1px, transparent 1px)', '12px 12px'],
            ['Lines', 'repeating-linear-gradient(45deg, transparent 0px 9px, #81818a 9px 10px)', 'auto'],
            ['Grid', 'linear-gradient(#81818a 1px, transparent 1px), linear-gradient(90deg, #81818a 1px, transparent 1px)', '20px 20px'],
            ['Checker', 'conic-gradient(#81818a 25%, transparent 0% 50%, #81818a 0% 75%, transparent 0%)', '24px 24px'],
        ];
        const gallery = document.createElement('div'); gallery.className = 'ink-shader-gallery';
        patterns.forEach(([title, image, size]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = title; button.style.backgroundImage = image; button.style.backgroundSize = size; button.addEventListener('click', () => { panel.runtime.history.begin('Apply pattern fill'); panel.setValue({ ...control, name: `${prefix}background-image` }, node, image); panel.setValue({ ...control, name: `${prefix}background-size` }, node, size); panel.runtime.history.commit(); }); gallery.appendChild(button); }); wrapper.appendChild(gallery);
        wrapper.appendChild(sub({ name: `${prefix}background-color`, type: 'color', label: 'Base color' }));
        wrapper.appendChild(sub({ name: `${prefix}background-size`, type: 'text', label: 'Tile size', placeholder: '20px 20px' }));
    } else if (!overlay && mode === 'shader') {
        renderShaderFill(panel, node, wrapper);
    } else if (!overlay && mode === 'video') {
        wrapper.appendChild(settingSub({ name: 'backgroundVideoUrl', type: 'url', label: 'Video Link', description: 'YouTube, Vimeo, or a direct MP4/WebM URL.' }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoStart', type: 'number', label: 'Start Time (seconds)', default: 0 }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoEnd', type: 'number', label: 'End Time (seconds)' }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoPlayOnce', type: 'switcher', label: 'Play Once' }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoPlayOnMobile', type: 'switcher', label: 'Play On Mobile', default: true }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoPrivacy', type: 'switcher', label: 'Privacy Mode', description: 'Uses youtube-nocookie.com for YouTube backgrounds.' }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoFallback', type: 'media', label: 'Background Fallback', accept: 'image/*' }));
    } else if (!overlay && mode === 'slideshow') {
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowImages', type: 'gallery', label: 'Images' }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowLoop', type: 'switcher', label: 'Infinite Loop', default: true }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowDuration', type: 'number', label: 'Duration (ms)', default: 5000 }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowTransition', type: 'select', label: 'Transition', default: 'fade', options: [
            { value: 'fade', label: 'Fade' }, { value: 'slide_right', label: 'Slide Right' }, { value: 'slide_left', label: 'Slide Left' }, { value: 'slide_up', label: 'Slide Up' }, { value: 'slide_down', label: 'Slide Down' },
        ] }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowTransitionDuration', type: 'number', label: 'Transition Duration (ms)', default: 500 }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowSize', type: 'select', label: 'Background Size', default: 'cover', options: ['auto', 'cover', 'contain'] }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowPosition', type: 'select', label: 'Background Position', default: 'center center', options: ['center center', 'center top', 'center bottom', 'left top', 'left center', 'left bottom', 'right top', 'right center', 'right bottom'] }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowLazyload', type: 'switcher', label: 'Lazy Load' }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowKenBurns', type: 'switcher', label: 'Ken Burns Effect' }));
        if (node.settings.backgroundSlideshowKenBurns) wrapper.appendChild(settingSub({ name: 'backgroundSlideshowZoomDirection', type: 'select', label: 'Zoom Direction', default: 'in', options: [{ value: 'in', label: 'In' }, { value: 'out', label: 'Out' }] }));
    }
    if (overlay && mode) {
        wrapper.appendChild(sub({ name: 'overlay-opacity', type: 'slider', label: 'Opacity', min: 0, max: 1, step: 0.01, default: 0.5, responsive: true }));
        wrapper.appendChild(sub({ name: 'overlay-filter', type: 'css-filters', label: 'CSS Filters' }));
        wrapper.appendChild(sub({ name: 'overlay-mix-blend-mode', type: 'select', label: 'Blend Mode', options: [{ value: '', label: 'Normal' }, 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'saturation', 'color', 'luminosity'] }));
    }
    if (mode && control.state === 'hover') wrapper.appendChild(sub({ name: overlay ? 'overlay-transition-duration' : 'background-transition-duration', state: 'base', type: 'slider', label: 'Transition Duration', min: 0, max: 3, step: 0.1, default: 0.3 }));
    const key = `${node.id}:${control.name}:${control.state || 'base'}`;
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ink-fill-trigger'; trigger.setAttribute('aria-label', overlay ? 'Edit overlay fill' : 'Edit fill'); trigger.setAttribute('aria-haspopup', 'dialog');
    const swatch = document.createElement('span'); swatch.className = 'ink-fill-swatch';
    const fillImage = styleValue(`${prefix}background-image`); const fillColor = styleValue(`${prefix}background-color`);
    if (typeof fillImage === 'string') swatch.style.backgroundImage = fillImage;
    if (typeof fillColor === 'string') swatch.style.backgroundColor = fillColor;
    const name = document.createElement('span'); name.textContent = displayedMode === 'shader' ? (SHADER_PRESETS.find(([id]) => id === node.settings.shaderFill?.preset)?.[1] || 'Custom shader') : displayedMode === 'gradient' ? 'Gradient' : ['video', 'slideshow'].includes(displayedMode) ? displayedMode[0].toUpperCase() + displayedMode.slice(1) : fillImage ? 'Image' : fillColor || 'Add fill…';
    trigger.append(swatch, name); row.appendChild(trigger);
    wrapper.classList.add('ink-fill-popover'); wrapper.setAttribute('role', 'dialog'); wrapper.setAttribute('aria-label', 'Fill editor');
    const header = document.createElement('div'); header.className = 'ink-fill-popover-head';
    const title = document.createElement('strong'); title.textContent = overlay ? 'Overlay fill' : 'Fill';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close fill editor'); header.append(title, close); wrapper.prepend(header);
    const hide = () => { panel.fillEditor = null; wrapper.remove(); trigger.setAttribute('aria-expanded', 'false'); };
    const show = () => {
        panel.fillEditor = key; document.body.appendChild(wrapper); trigger.setAttribute('aria-expanded', 'true');
        const rect = trigger.getBoundingClientRect();
        wrapper.style.left = `${Math.max(8, Math.min(innerWidth - 312, rect.left - 312))}px`;
        wrapper.style.top = `${Math.max(8, Math.min(innerHeight - wrapper.offsetHeight - 8, rect.top))}px`;
    };
    close.addEventListener('click', () => { hide(); trigger.focus(); });
    trigger.addEventListener('click', () => wrapper.isConnected ? hide() : show());
    document.addEventListener('pointerdown', (event) => { if (wrapper.isConnected && !wrapper.contains(event.target) && !trigger.contains(event.target) && !event.target.closest('.ink-v2-color-studio')) hide(); }, { signal: panel.renderAbort.signal });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && wrapper.isConnected) { hide(); trigger.focus(); event.stopPropagation(); } }, { signal: panel.renderAbort.signal });
    panel.renderAbort.signal.addEventListener('abort', () => wrapper.remove(), { once: true });
    if (panel.fillEditor === key) requestAnimationFrame(() => { if (row.isConnected) show(); });
    return row;
}

function renderShaderFill(panel, node, wrapper) {
    const values = normalizeShader(node.settings.shaderFill);
    const update = (patch) => panel.runtime.update(node.id, { settings: { shaderFill: { ...values, enabled: true, ...patch } } }, 'Change shader fill');
    const gallery = document.createElement('div'); gallery.className = 'ink-shader-gallery'; gallery.setAttribute('aria-label', 'Shader presets');
    SHADER_PRESETS.forEach(([id, title, a, b, c]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = title; button.setAttribute('aria-pressed', String(values.preset === id)); button.style.backgroundImage = `radial-gradient(ellipse at 80% 20%, ${c}, transparent 65%), linear-gradient(135deg, ${a}, ${b})`; button.addEventListener('click', () => update({ preset: id, colorA: a, colorB: b, colorC: c })); gallery.appendChild(button); }); wrapper.appendChild(gallery);
    const proxy = Object.create(panel); proxy.setValue = (control, _node, value) => update({ [control.name]: value });
    [['colorA','Base'],['colorB','Primary'],['colorC','Accent']].forEach(([name,label]) => { const row = document.createElement('div'); row.className = 'ink-v2-control'; row.append(label); color(proxy, { name }, node, values[name], row); wrapper.appendChild(row); });
    const animate = document.createElement('label'); animate.className = 'ink-shader-animate'; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = values.animate; check.addEventListener('change', () => update({ animate: check.checked })); animate.append(check,'Animate'); wrapper.appendChild(animate);
    [['speed','Speed',0,2,.05],['intensity','Intensity',0,1,.01],['grain','Grain',0,.3,.01]].forEach(([name,label,min,max,step]) => { const row = document.createElement('label'); row.className = 'ink-shader-number'; row.append(label); const input = document.createElement('input'); input.type = 'number'; input.min = min; input.max = max; input.step = step; input.value = values[name]; input.setAttribute('aria-label', `Shader ${label.toLowerCase()}`); input.addEventListener('change', () => update({ [name]: Math.max(min,Math.min(max,Number(input.value)||0)) })); row.appendChild(input); wrapper.appendChild(row); });
    const custom = document.createElement('details'); custom.className = 'ink-shader-custom'; custom.open = values.preset === 'custom'; const summary = document.createElement('summary'); summary.textContent = 'Custom shader';
    const hint = document.createElement('p'); hint.textContent = 'GLSL · inkShader(uv, time, resolution). Colors a, b, c and intensity are available.';
    const code = document.createElement('textarea'); code.rows = 8; code.value = values.customCode || CUSTOM_SHADER_EXAMPLE; code.setAttribute('aria-label', 'Custom shader GLSL');
    const error = document.createElement('p'); error.className = 'ink-shader-error'; error.setAttribute('role', 'alert');
    const apply = document.createElement('button'); apply.type = 'button'; apply.textContent = 'Apply shader'; apply.addEventListener('click', () => { try { validateCustomShader(code.value); update({ preset: 'custom', customCode: code.value }); } catch (failure) { error.textContent = failure.message; } });
    const ai = document.createElement('button'); ai.type = 'button'; ai.textContent = 'Create with Agent'; ai.addEventListener('click', () => { document.querySelector('[data-tab="copilot"]')?.click(); const prompt = document.querySelector('[data-builder-copilot-target="prompt"]'); if (prompt) { prompt.value = 'Create a custom shader fill for this selected layer. '; prompt.focus(); } panel.fillEditor = null; wrapper.remove(); });
    custom.append(summary,hint,code,error,apply,ai); wrapper.appendChild(custom);
}

export function shapeDivider(panel, control, node, value, row) {
    row.classList.add('ink-v2-control-group');
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-shape-divider';
    const side = panel.shapeDividerSides.get(node.id) || 'top';
    const tabs = document.createElement('div'); tabs.className = 'ink-v2-states'; tabs.style.setProperty('--ink-state-count', 2);
    ['top', 'bottom'].forEach((name) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = name[0].toUpperCase() + name.slice(1); button.classList.toggle('is-active', side === name);
        button.addEventListener('click', () => { panel.shapeDividerSides.set(node.id, name); panel.render(); }); tabs.appendChild(button);
    });
    wrapper.appendChild(tabs);
    const settingName = `shapeDivider${side[0].toUpperCase()}${side.slice(1)}`;
    const dividerValue = node.settings[settingName] && typeof node.settings[settingName] === 'object' ? node.settings[settingName] : {};
    const update = (patch) => panel.runtime.update(node.id, { settings: { [settingName]: { ...dividerValue, ...patch } } }, `Change ${side} shape divider`);
    const field = (labelText, input) => { const fieldRow = document.createElement('label'); fieldRow.className = 'ink-v2-shape-field'; const label = document.createElement('span'); label.textContent = labelText; fieldRow.append(label, input); wrapper.appendChild(fieldRow); return input; };
    const type = document.createElement('select'); type.add(new Option('None', '')); Object.entries(ELEMENTOR_SHAPES).forEach(([key, shape]) => type.add(new Option(shape.title, key))); type.value = dividerValue.type || ''; type.addEventListener('change', () => update({ type: type.value })); field('Type', type);
    if (dividerValue.type) {
        const shapeMeta = ELEMENTOR_SHAPES[dividerValue.type] || {};
        const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = /^#[0-9a-f]{6}$/i.test(dividerValue.color || '') ? dividerValue.color : '#ffffff'; colorInput.addEventListener('change', () => update({ color: colorInput.value })); field('Color', colorInput);
        [...(shapeMeta.heightOnly ? [] : [['Width', 'width', 100, 300, 100, '%']]), ['Height', 'height', 0, 500, 100, 'px']].forEach(([labelText, key, min, max, fallback, unit]) => {
            const group = document.createElement('div'); group.className = 'ink-v2-shape-range'; const range = document.createElement('input'); range.type = 'range'; range.min = min; range.max = max; range.value = dividerValue[key] ?? fallback; const number = document.createElement('input'); number.type = 'number'; number.min = min; number.max = max; number.value = range.value; const suffix = document.createElement('span'); suffix.textContent = unit;
            range.addEventListener('input', () => { number.value = range.value; }); const commit = (source) => { range.value = source.value; number.value = source.value; update({ [key]: Number(source.value) }); }; range.addEventListener('change', () => commit(range)); number.addEventListener('change', () => commit(number)); group.append(range, number, suffix); field(labelText, group);
        });
        [...(shapeMeta.flip ? [['Flip', 'flip']] : []), ...(shapeMeta.negative ? [['Invert', 'invert']] : []), ['Bring to Front', 'front']].forEach(([labelText, key]) => {
            const { wrapper: switcher, checkbox } = switchControl({ checked: !!dividerValue[key], ariaLabel: labelText }); checkbox.addEventListener('change', () => update({ [key]: checkbox.checked })); field(labelText, switcher);
        });
    }
    row.appendChild(wrapper); return row;
}

export function typography(panel, control, node, value, row) {
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-background ink-v2-typography';
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ink-v2-background-trigger'; trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="material-symbols-rounded">text_fields</span><span>Typography</span>';
    const body = document.createElement('div'); body.className = 'ink-v2-background-body';
    const sub = (partial) => panel.renderControl({ tab: control.tab, target: control.target, section: control.section, ...partial }, node);
    body.appendChild(sub({ name: 'font-family', type: 'font', label: 'Font family', options: ['inherit', 'system-ui, sans-serif', ...availableFonts(panel.runtime.document)] }));
    body.appendChild(sub({ name: 'font-size', type: 'size', label: 'Size', units: ['px', 'rem', 'em', 'vw'], responsive: true }));
    body.appendChild(sub({ name: 'font-weight', type: 'select', label: 'Weight', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] }));
    body.appendChild(sub({ name: 'font-style', type: 'select', label: 'Style', options: ['normal', 'italic', 'oblique'] }));
    body.appendChild(sub({ name: 'text-transform', type: 'select', label: 'Transform', options: ['none', 'uppercase', 'lowercase', 'capitalize'] }));
    body.appendChild(sub({ name: 'text-decoration', type: 'select', label: 'Decoration', options: ['none', 'underline', 'line-through', 'overline'] }));
    body.appendChild(sub({ name: 'line-height', type: 'size', label: 'Line height', units: ['', 'px', 'em'], responsive: true }));
    body.appendChild(sub({ name: 'letter-spacing', type: 'size', label: 'Letter spacing', units: ['px', 'em'], responsive: true }));
    body.appendChild(sub({ name: 'text-wrap', type: 'choose', label: 'Wrapping', options: [{ value: 'wrap', label: 'Wrap' }, { value: 'balance', label: 'Balance' }, { value: 'pretty', label: 'Pretty' }, { value: 'nowrap', label: 'No wrap' }], responsive: true }));
    body.appendChild(sub({ name: 'font-feature-settings', type: 'text', label: 'OpenType features', placeholder: '"liga" 1, "ss01" 1', description: 'Enable ligatures, stylistic sets, and other OpenType features.' }));
    body.appendChild(sub({ name: 'font-variation-settings', type: 'text', label: 'Variable axes', placeholder: '"wght" 650, "wdth" 90', description: 'Set axes exposed by a variable font.' }));
    const toggle = () => { const open = wrapper.classList.toggle('is-open'); trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    trigger.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); toggle(); });
    wrapper.append(trigger, body); row.appendChild(wrapper); return row;
}

export function structure(panel, control, node, value, row) {
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-structure';
    const grid = document.createElement('div'); grid.className = 'ink-v2-structure-grid';
    (control.options || []).forEach((option) => {
        const preset = String(valueFor(option)); const widths = preset.split(',').map(Number);
        const button = document.createElement('button'); button.type = 'button'; button.title = labelFor(option);
        const current = node.settings[control.name] || node.settings.structure;
        button.classList.toggle('is-active', String(current) === preset);
        button.setAttribute('aria-label', labelFor(option) || preset);
        button.innerHTML = `<span class="ink-v2-structure-cols">${widths.map((w) => `<i style="flex:${w}"></i>`).join('')}</span><span class="ink-v2-structure-label">${labelFor(option)}</span>`;
        button.addEventListener('click', () => { panel.applyStructure(node, preset); panel.render(); });
        grid.appendChild(button);
    });
    wrapper.appendChild(grid); row.appendChild(wrapper); return row;
}

export function popoverToggle(panel, control, node, value, row) {
    const details = document.createElement('details'); details.className = 'ink-v2-popover'; const summary = document.createElement('summary'); summary.textContent = control.text || 'Open settings'; details.appendChild(summary);
    (control.controls || []).forEach((nested) => details.appendChild(panel.renderControl({ tab: control.tab, section: control.section, target: control.target, ...nested }, node))); row.appendChild(details); return row;
}

export function notice(panel, control, node, value, row) {
    row.classList.add(`ink-v2-control-${control.type}`);
    if (control.type === 'divider') row.appendChild(document.createElement('hr'));
    else { const message = document.createElement(control.type === 'heading' ? 'h4' : 'div'); message.textContent = control.text || control.content || control.label; row.replaceChildren(message); }
    return row;
}

export function actionButton(panel, control, node, value, row) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'ink-v2-action-button'; button.textContent = control.text || control.label;
    button.addEventListener('click', () => control.onClick?.({ runtime: panel.runtime, node, control })); row.appendChild(button); return row;
}

export function hidden(panel, control, node, value, row) { row.hidden = true; return row; }

export function wysiwyg(panel, control, node, value, row) {
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-wysiwyg';
    const toolbar = document.createElement('div'); toolbar.className = 'ink-v2-wysiwyg-toolbar';
    const adapter = new RichTextAdapter();
    const commands = [
        [0, 'toggleBold', 'B', 'bold', null], [1, 'toggleItalic', 'I', 'italic', null], [2, 'toggleUnderline', 'U', 'underline', null], [3, 'toggleStrike', 'S', 'strike', null],
        [4, 'toggleBulletList', '• List', 'bulletList', null], [5, 'toggleOrderedList', '1. List', 'orderedList', null],
        [6, 'setParagraph', '¶', 'paragraph', null], [7, 'toggleHeading', 'H1', 'heading', { level: 1 }], [8, 'toggleHeading', 'H2', 'heading', { level: 2 }], [9, 'toggleHeading', 'H3', 'heading', { level: 3 }],
        [10, 'toggleBlockquote', '❝', 'blockquote', null], [11, 'toggleCodeBlock', '</>', 'codeBlock', null], [12, 'setHorizontalRule', '—', null, null],
    ];
    const refreshActive = () => {
        commands.forEach(([index, command, label, stateCommand, arg]) => {
            if (!stateCommand) return;
            const button = toolbar.querySelector(`[data-cmd="${index}"]`);
            if (button) button.classList.toggle('is-active', adapter.isActive(stateCommand));
        });
    };
    commands.forEach(([index, command, label, stateCommand, arg]) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.title = command; button.dataset.cmd = String(index);
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', (event) => {
            event.preventDefault();
            if (arg) adapter.runCommand(command, arg);
            else adapter.runCommand(command);
            refreshActive();
        });
        toolbar.appendChild(button);
    });
    const editor = document.createElement('div'); editor.className = 'ink-v2-wysiwyg-editor';
    const initial = value && typeof value === 'object' && value.json ? value.json : (typeof value === 'string' && value.startsWith('{') ? (() => { try { return JSON.parse(value); } catch (_) { return null; } })() : null);
    adapter.mount(editor, {
        content: initial || (typeof value === 'string' && !value.startsWith('{') ? value : '<p></p>'),
        onChange: (json) => panel.setValue(control, node, { json, html: adapter.getHTML() }),
    });
    wrapper.append(toolbar, editor); row.appendChild(wrapper);
    editor.addEventListener('keyup', refreshActive); editor.addEventListener('mouseup', refreshActive); editor.addEventListener('keydown', () => setTimeout(refreshActive, 0));
    return row;
}

/* ------------------------------------------------------------------ *
 * Dynamic data binding
 * Lets an element pull its value from site/post data. Writes a
 * `{{ source.field }}` token into a target setting; the published page
 * resolves it server-side (PageBuilder::ErbConverter) and the canvas
 * previews a sample value.
 * ------------------------------------------------------------------ */
export function dataBinding(panel, control, node, _value, row) {
    const target = control.bindingFor || control.name;
    const sources = (typeof window !== 'undefined' && window.inkDataSources && window.inkDataSources.sources) || {};
    const current = String(node.settings?.[target] ?? '');
    const match = current.match(/\{\{\s*([\w.]+)\s*\}\}/);
    let currentSource = '';
    let currentField = '';
    if (match) { const [src, ...rest] = match[1].split('.'); currentSource = src; currentField = rest.join('.'); }

    const grid = document.createElement('div');
    grid.className = 'ink-v2-data-binding';

    const sourceSelect = document.createElement('select');
    sourceSelect.setAttribute('aria-label', 'Data source');
    sourceSelect.add(new Option('Static', ''));
    Object.entries(sources).forEach(([key, def]) => sourceSelect.add(new Option(def.label || key, key)));
    sourceSelect.value = currentSource;

    const fieldSelect = document.createElement('select');
    fieldSelect.setAttribute('aria-label', 'Field');

    const renderFields = () => {
        fieldSelect.replaceChildren();
        const def = sources[sourceSelect.value];
        fieldSelect.disabled = !def;
        if (!def) { fieldSelect.add(new Option('Static', '')); return; }
        fieldSelect.add(new Option('Choose field…', ''));
        Object.entries(def.fields || {}).forEach(([path, label]) => fieldSelect.add(new Option(label, path)));
        fieldSelect.value = currentField;
    };
    renderFields();

    const write = (value) => panel.setValue({ ...control, name: target, target: 'settings' }, node, value);
    sourceSelect.addEventListener('change', () => {
        renderFields();
        if (!sourceSelect.value) write('');
    });
    fieldSelect.addEventListener('change', () => {
        if (sourceSelect.value && fieldSelect.value) write(`{{ ${sourceSelect.value}.${fieldSelect.value} }}`);
    });

    grid.append(sourceSelect, fieldSelect);
    row.appendChild(grid);
    return row;
}

// Component states: the named variants an element can be in (e.g. "monthly, yearly"). They feed
// the state switcher in the panel and compile to [data-ink-state="…"] rules. See states.js.
export function stateNames(panel, control, node, value, row) {
    const list = normalizeStateList(value);
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-state-names';
    const input = document.createElement('input'); input.type = 'text';
    input.placeholder = 'open, closed';
    input.value = list.join(', ');
    input.setAttribute('aria-label', control.label || 'Component states');
    commitOnFinish(input, () => panel.setValue(control, node, normalizeStateList(input.value)));
    const hint = document.createElement('small'); hint.className = 'ink-v2-control-description';
    hint.textContent = 'Variant names this element can be in. Style each one from the state switcher, then switch them with an interaction.';
    wrapper.append(input, hint);
    row.appendChild(wrapper);
    return row;
}

// Interactions: an event on this element that changes a target. Declarative element data, so it
// runs in Preview and published pages and is undoable — never hand-written script.
export function interactions(panel, control, node, value, row) {
    const list = normalizeInteractions(value);
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-interactions';
    const commit = () => panel.setValue(control, node, normalizeInteractions(list));
    const field = (labelText, input) => { const label = document.createElement('label'); label.textContent = labelText; label.appendChild(input); return label; };
    const select = (options, labels, current, onChange) => {
        const element = document.createElement('select');
        options.forEach((option) => element.add(new Option(labels[option] || option, option)));
        element.value = current;
        element.addEventListener('change', () => onChange(element.value));
        return element;
    };

    list.forEach((record, index) => {
        const item = document.createElement('div'); item.className = 'ink-v2-interaction';
        const update = (patch) => { list[index] = { ...list[index], ...patch }; commit(); };
        const header = document.createElement('div'); header.className = 'ink-v2-interaction-head';

        header.appendChild(field('When', select(INTERACTION_EVENTS, INTERACTION_EVENT_LABELS, record.on, (next) => update({ on: next }))));
        header.appendChild(field('Do', select(INTERACTION_ACTIONS, INTERACTION_ACTION_LABELS, record.action, (next) => update({ action: next, ...(['toggleState', 'setState'].includes(next) && !record.state ? { state: 'open' } : {}) }))));
        header.appendChild(field('Target', select(INTERACTION_TARGETS, INTERACTION_TARGET_LABELS, record.target, (next) => update({ target: next, ...(next === 'query' && !record.selector ? { selector: '.selector' } : {}) }))));

        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'ink-v2-action-button is-quiet';
        remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove interaction');
        remove.addEventListener('click', () => { list.splice(index, 1); commit(); });
        header.appendChild(remove);

        const detail = document.createElement('div'); detail.className = 'ink-v2-interaction-detail';
        if (['toggleState', 'setState'].includes(record.action)) {
            const state = document.createElement('input'); state.type = 'text'; state.value = record.state || '';
            state.placeholder = 'open';
            commitOnFinish(state, () => update({ state: normalizeStateName(state.value) }));
            detail.appendChild(field('State', state));
            const exclusive = switchControl({ checked: record.exclusive === true, onLabel: 'One', offLabel: 'Many', ariaLabel: 'Exclusive state' });
            exclusive.checkbox.addEventListener('change', () => update({ exclusive: exclusive.checkbox.checked }));
            detail.appendChild(field('Siblings', exclusive.wrapper));
        }
        if (record.action === 'toggleClass') {
            const className = document.createElement('input'); className.type = 'text'; className.value = record.className || '';
            className.placeholder = 'is-open';
            commitOnFinish(className, () => update({ className: className.value.trim() }));
            detail.appendChild(field('Class', className));
        }
        if (record.target === 'query') {
            // The target of an interaction is a layer, not a CSS string: pick it on the canvas, and
            // the panel reports what the selector currently resolves to (or that nothing matches).
            const picker = document.createElement('div'); picker.className = 'ink-v2-target-picker';
            const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'ink-v2-action-button'; pick.textContent = 'Pick on canvas';
            const selector = document.createElement('input'); selector.type = 'text'; selector.value = record.selector || '';
            selector.placeholder = '.ink-el-…  or any CSS selector';
            selector.setAttribute('aria-label', 'Target selector');
            commitOnFinish(selector, () => update({ selector: selector.value.trim() }));
            const resolved = document.createElement('small'); resolved.className = 'ink-v2-target-status';
            const describe = () => {
                const label = resolveTargetLabel(panel, selector.value.trim());
                if (label) { resolved.textContent = `Targets ${label}`; resolved.dataset.state = 'found'; return; }
                resolved.textContent = selector.value.trim() ? 'No layer matches this selector' : 'No target picked yet';
                resolved.dataset.state = 'missing';
            };
            describe();
            selector.addEventListener('input', describe);
            pick.addEventListener('click', async () => {
                if (typeof panel.runtime.pickElement !== 'function') return;
                pick.classList.add('is-armed'); pick.textContent = 'Click a layer…';
                const picked = await panel.runtime.pickElement();
                pick.classList.remove('is-armed'); pick.textContent = 'Pick on canvas';
                if (!picked) { resolved.textContent = 'Pick cancelled'; resolved.dataset.state = 'missing'; return; }
                const next = `.ink-el-${picked}`;
                selector.value = next; describe();
                update({ selector: next, target: 'query' });
            });
            picker.append(pick, selector, resolved);
            detail.appendChild(field('Target layer', picker));
        }
        const delay = document.createElement('input'); delay.type = 'number'; delay.min = '0'; delay.step = '50'; delay.value = record.delay || 0;
        commitOnFinish(delay, () => update({ delay: Number(delay.value) || 0 }));
        detail.appendChild(field('Delay (ms)', delay));

        item.append(header, detail);
        wrapper.appendChild(item);
    });

    const add = document.createElement('button'); add.type = 'button'; add.className = 'ink-v2-action-button';
    add.textContent = list.length ? 'Add another interaction' : 'Add interaction';
    add.addEventListener('click', () => { list.push({ on: 'click', action: 'toggleState', target: 'self', state: 'open' }); commit(); });
    wrapper.appendChild(add);

    const hint = document.createElement('small'); hint.className = 'ink-v2-control-description';
    hint.textContent = 'Runs in Preview and on the published page. Pick a target layer on the canvas to change it — a panel that should open, for example.';
    wrapper.appendChild(hint);

    row.appendChild(wrapper);
    return row;
}
