// Motion groups turn the motion of several sibling elements into ONE authored timeline.
//
// A group is ordinary element data on the parent (`settings.motionGroup`): a trigger shared by its
// children, a stagger between them, and — for scroll groups — the reference they scrub against.
// Children keep their own `settings.motion` keyframes, so a group orchestrates what each layer
// already does instead of hiding it. Nothing here is a runtime feature: load/hover/enter compile
// to CSS (see StyleEngine), scroll groups share one progress driver (see scrollMotionRuntime), and
// every value stays editable in the Motion panel — by a human, the importer, or the Copilot.
//
// This is what lets an imported deck unfold on hover, a grid reveal card by card, or a pinned
// section scrub a whole timeline, using only data the builder already stores.

import { EASING_CSS_PATTERN } from './easing.js';

export const MOTION_GROUP_TRIGGERS = ['inherit', 'load', 'enter', 'hover', 'scroll'];
export const MOTION_GROUP_KINDS = ['group', 'stagger', 'unfold', 'orbit3d', 'scrub', 'carousel'];

export const MOTION_GROUP_TRIGGER_LABELS = {
    inherit: 'Each child', load: 'Page load', enter: 'Section enters view', hover: 'Hover the group', scroll: 'Scroll progress',
};
export const MOTION_GROUP_KIND_LABELS = {
    group: 'Group', stagger: 'Staggered reveal', unfold: 'Hover unfold', orbit3d: '3D orbit', scrub: 'Scroll timeline', carousel: 'Carousel',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value, fallback = 0) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; };
const pick = (list, value, fallback) => (list.includes(String(value ?? '').toLowerCase()) ? String(value).toLowerCase() : fallback);

// Canonical, serializable group. Returns null for anything that is not a group, so callers can
// treat "no group" and "empty object" identically.
export function normalizeMotionGroup(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const group = { kind: pick(MOTION_GROUP_KINDS, raw.kind, 'group'), trigger: pick(MOTION_GROUP_TRIGGERS, raw.trigger, 'inherit') };
    const label = String(raw.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (label) group.label = label;
    const stagger = clamp(Math.round(number(raw.stagger)), 0, 2000);
    if (stagger) group.stagger = stagger;
    const duration = clamp(Math.round(number(raw.duration)), 0, 60000);
    if (duration) group.duration = duration;
    const delay = clamp(Math.round(number(raw.delay)), 0, 60000);
    if (delay) group.delay = delay;
    if (EASING_CSS_PATTERN.test(String(raw.easing || '').trim())) group.easing = String(raw.easing);
    if (raw.iterations === 'infinite') group.iterations = 'infinite';
    else { const iterations = clamp(Math.round(number(raw.iterations, 1)), 1, 99); if (iterations !== 1) group.iterations = iterations; }
    if (raw.perspective != null) group.perspective = clamp(Math.round(number(raw.perspective)), 100, 5000);
    if (raw.scrub && typeof raw.scrub === 'object') group.scrub = {
        reference: raw.scrub.reference === 'parent' ? 'parent' : 'group',
        start: clamp(number(raw.scrub.start), 0, 1),
        end: clamp(number(raw.scrub.end, 1), 0, 1),
    };
    if (raw.pin && typeof raw.pin === 'object') group.pin = { enabled: raw.pin.enabled !== false, distance: clamp(Math.round(number(raw.pin.distance, 100)), 0, 400) };
    if (raw.count != null) group.count = clamp(Math.round(number(raw.count)), 0, 500);
    return group;
}

export function isGroupOrchestrated(group) { return Boolean(group) && group.trigger !== undefined && group.trigger !== 'inherit'; }
export function isSharedTrigger(group) { return Boolean(group) && ['hover', 'scroll'].includes(group.trigger); }

// Resolve one child's motion against its parent group. The child keeps its keyframes; the group
// contributes the shared trigger, timing, and stagger offset. Index is the child's position among
// its siblings, so a stagger reads left-to-right / top-to-bottom exactly as authored.
export function effectiveMotion(motion, group, index = 0) {
    if (!motion || motion.enabled === false) return null;
    const resolved = { ...motion };
    if (group) {
        if (group.trigger && group.trigger !== 'inherit') resolved.trigger = group.trigger;
        if (group.duration) resolved.duration = group.duration;
        if (group.easing) resolved.easing = group.easing;
        if (group.iterations) resolved.iterations = group.iterations;
        if (group.delay) resolved.delay = number(resolved.delay) + group.delay;
        const stagger = number(group.stagger);
        if (stagger) resolved.delay = number(resolved.delay) + Math.max(0, index) * stagger;
        resolved.groupTrigger = group.trigger;
    }
    resolved.motionIndex = Math.max(0, index);
    return resolved;
}

// The authored timeline of a group: which children take part, and when each one starts. Used by
// the Motion panel and by Copilot's read_design so the plan is inspectable without running it.
export function motionGroupItems(node) {
    const group = normalizeMotionGroup(node?.settings?.motionGroup);
    const children = Array.isArray(node?.children) ? node.children : [];
    return children.reduce((items, child, index) => {
        const motion = effectiveMotion(child?.settings?.motion, group, index);
        if (!motion || !Array.isArray(motion.keyframes) || motion.keyframes.length < 2) return items;
        items.push({ index, id: child.id, label: child.settings?.label || '', trigger: motion.trigger, delay: number(motion.delay), duration: number(motion.duration) });
        return items;
    }, []);
}

export function describeMotionGroup(raw) {
    const group = normalizeMotionGroup(raw);
    if (!group) return '';
    const parts = [group.label || MOTION_GROUP_KIND_LABELS[group.kind] || group.kind];
    parts.push(MOTION_GROUP_TRIGGER_LABELS[group.trigger] || group.trigger);
    if (group.stagger) parts.push(`${group.stagger}ms stagger`);
    if (group.pin?.enabled) parts.push(`pinned ${group.pin.distance}vh`);
    if (group.count) parts.push(`${group.count} layers`);
    return parts.join(' · ');
}

// Detectors and Copilot both need to answer "does this group orchestrate the given child?".
export function groupOrchestrates(group, child) {
    if (!group || group.trigger === 'inherit') return false;
    return Boolean(child?.settings?.motion);
}
