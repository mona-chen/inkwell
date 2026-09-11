// Dynamic content preview helpers.
//
// Bound values are stored as `{{ source.field }}` tokens so the published page resolves them
// server-side through PageBuilder::ErbConverter. In the canvas we swap those tokens for sample
// values (window.inkSampleData, served by PageBuilder::DataSources) so authors see realistic
// content while designing, without changing what gets saved.

export function sampleData() {
    return (typeof window !== 'undefined' && window.inkSampleData) || {};
}

export function resolveString(value, data = sampleData()) {
    if (typeof value !== 'string' || value.indexOf('{{') === -1) return value;
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
        const [source, ...rest] = path.split('.');
        let current = data[source];
        for (const key of rest) {
            if (current == null) return match;
            current = current[key];
        }
        return current == null ? match : String(current);
    });
}

// Returns a shallow clone of the node whose string settings have been resolved for display.
// Nested structures (arrays/objects) are passed through untouched.
export function previewNode(node, data = sampleData()) {
    if (!node || !node.settings) return node;
    const settings = { ...node.settings };
    let changed = false;
    for (const key of Object.keys(settings)) {
        if (typeof settings[key] === 'string' && settings[key].indexOf('{{') !== -1) {
            settings[key] = resolveString(settings[key], data);
            changed = true;
        }
    }
    return changed ? { ...node, settings } : node;
}
