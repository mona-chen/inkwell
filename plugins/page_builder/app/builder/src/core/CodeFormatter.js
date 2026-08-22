const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const attributes = (element) => [...element.attributes]
    .map((attribute) => `${attribute.name}="${attribute.value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`)
    .join(' ');

const formatNode = (node, depth = 0) => {
    const indent = '  '.repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        return text ? `${indent}${text}` : '';
    }
    if (node.nodeType === Node.COMMENT_NODE) return `${indent}<!--${node.textContent}-->`;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const attrs = attributes(node);
    const open = `<${tag}${attrs ? ` ${attrs}` : ''}>`;
    if (VOID_TAGS.has(tag)) return `${indent}${open}`;
    const children = [...node.childNodes].filter((child) => child.nodeType !== Node.TEXT_NODE || child.textContent.trim());
    if (!children.length) return `${indent}${open}</${tag}>`;
    if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE && children[0].textContent.trim().length < 90) {
        return `${indent}${open}${children[0].textContent.replace(/\s+/g, ' ').trim()}</${tag}>`;
    }
    return `${indent}${open}\n${children.map((child) => formatNode(child, depth + 1)).filter(Boolean).join('\n')}\n${indent}</${tag}>`;
};

const formatHtml = (source) => {
    const document = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html');
    return [...document.body.childNodes].map((node) => formatNode(node)).filter(Boolean).join('\n');
};

const formatDelimited = (source, language) => {
    let output = '', depth = 0, quote = '', escaped = false, comment = '';
    const newline = () => { output = output.trimEnd() + '\n' + '  '.repeat(depth); };
    for (let index = 0; index < source.length; index += 1) {
        const char = source[index], next = source[index + 1];
        if (comment === 'line') { output += char; if (char === '\n') { comment = ''; output += '  '.repeat(depth); } continue; }
        if (comment === 'block') { output += char; if (char === '*' && next === '/') { output += '/'; index += 1; comment = ''; } continue; }
        if (quote) { output += char; if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = ''; continue; }
        if (char === '/' && next === '/' && language === 'js') { output += '//'; index += 1; comment = 'line'; continue; }
        if (char === '/' && next === '*') { output += '/*'; index += 1; comment = 'block'; continue; }
        if (char === '"' || char === "'" || (char === '`' && language === 'js')) { quote = char; output += char; continue; }
        if (char === '{') { output = output.trimEnd() + ' {'; depth += 1; newline(); continue; }
        if (char === '}') { depth = Math.max(0, depth - 1); output = output.trimEnd(); newline(); output += '}'; if (next && !/[;,)]/.test(next)) newline(); continue; }
        if (char === ';') { output += ';'; newline(); continue; }
        if (char === '\n' || char === '\r') { if (!output.endsWith('\n')) newline(); continue; }
        output += char;
    }
    return output.trim().replace(/\n{3,}/g, '\n\n');
};

export async function formatCode(file, source) {
    const text = String(source || '').trim();
    if (!text) return '';
    try {
        if (file === 'html') return formatHtml(text);
        if (file === 'css' || file === 'js') return formatDelimited(text, file);
        return text;
    } catch (error) {
        console.warn(`[Ink Builder] Could not format ${file}:`, error.message);
        return text;
    }
}
