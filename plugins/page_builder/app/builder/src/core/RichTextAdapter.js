// Shared TipTap rich-text adapter (Elementor Text Editor + classic writer both use it).
// Wraps the pre-bundled TipTap ESM (vendor/tiptap.js, esbuild-built from the StarterKit) so
// the builder stores a canonical ProseMirror JSON document and derives sanitized, schema-bound
// HTML for canvas + published output. The Ruby renderer (Blocks::RichTextComponent) uses the
// same allowlisted schema — no stored HTML is ever executed.
import { createRichText } from '../vendor/tiptap.js';

export class RichTextAdapter {
    constructor() {
        this.editor = null;
        this.element = null;
    }

    mount(element, options = {}) {
        const { content = null, onChange = () => {} } = options;
        this.element = element;
        this.editor = createRichText(element, {
            content: content || '<p></p>',
            onChange: (jsonString) => {
                try { onChange(JSON.parse(jsonString)); } catch (_) {}
            },
        });
        return this;
    }

    getJSON() {
        return this.editor ? this.editor.getJSON() : { type: 'doc', content: [] };
    }

    getHTML() {
        return this.editor ? this.editor.getHTML() : '';
    }

    setDocument(doc) {
        if (this.editor) this.editor.commands.setContent(doc || { type: 'doc', content: [] });
    }

    runCommand(command, attributes = null) {
        if (!this.editor) return;
        const chain = this.editor.chain().focus();
        if (attributes != null) chain[command](attributes);
        else chain[command]();
        chain.run();
    }

    isActive(command) {
        return this.editor ? this.editor.isActive(command) : false;
    }

    destroy() {
        this.editor?.destroy();
        this.editor = null;
        this.element = null;
    }
}
