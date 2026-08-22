// Ink Builder v2 entry.
// Only the v2 runtime is shipped: the element registry (core/), the floating Structure
// panel, the custom-code capability, and the editor chrome stylesheet. The v1 email-builder
// runtime (includes/* element/control/widget classes, ejs templates) is removed.

import TabsManager from './includes/TabsManager.js';
import EditorRuntime from './core/EditorRuntime.js';
import BuilderV2 from './core/BuilderV2.js';

// Editor chrome stylesheet — SCSS partials compiled by webpack into dist/builder.css.
import './styles/editor.scss';

// Globals the Rails layout relies on.
window.TabsManager = TabsManager;
window.InkEditorRuntime = EditorRuntime;
window.InkBuilderV2 = BuilderV2;
