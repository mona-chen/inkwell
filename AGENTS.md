<!-- nitro-kit:start -->
## Nitro Kit 2

This application uses Nitro Kit 2.x. Before changing Rails structure,
Hotwire interactions, or UI, use the matching project-local Nitro Kit skill.
Each skill resolves the installed gem with `bundle show nitro_kit` and reads
its version-matched documentation.

Do not use Nitro Kit 1.x APIs, `nk_*` helpers, copied Nitro components, or
application-owned `controllers/nk`. Compose the installed Phlex Kit and keep
routes, records, authorization, queries, DOM IDs, and server responses in the
application.

During migration, replace an existing form control only when Nitro Kit 2 has
a genuine semantic and behavioral equivalent. Otherwise preserve the control
as application-owned Rails and semantic HTML. Never downgrade specialized
behavior or retain copied Nitro Kit 1.x source as the fallback.
<!-- nitro-kit:end -->

## Ink Builder architecture

The Ink Builder is a first-class, source-owned component — we edit the SOURCE and rebuild;
never inspect build output to understand behavior.

- **Source**: `plugins/page_builder/app/builder/src/`.
  - `core/` — the v2 runtime (EditorRuntime, BuilderV2, CanvasRenderer, PanelManager,
    DragDropManager, StyleEngine, the Ink element registries `inkElements.js`,
    `inkFoundationElements.js`, `inkMagicElements.js`, …). This is the source of truth for
    builder behavior.
  - `styles/` — editor chrome and canvas styles split into SCSS partials
    (`editor/_appbar.scss`, `_panel.scss`, `_controls.scss`, … and
    `canvas/_base.scss`, `_typography.scss`, `_button.scss`, `_boxes.scss`, `_data.scss`,
    `_content.scss`, `_media.scss`, `_magic.scss`). Editor chrome uses `--ink-editor-*`
    tokens with a dark (default) and `[data-ink-theme="light"]` palette.
  - `includes/` — only `TabsManager.js` (layout container switching) and
    `CustomCodeManager.js` (custom CSS/JS + the design-kit vocabulary) remain; the v1
    email-builder runtime is removed.
- **Build**: `npm run build` in `plugins/page_builder/app/builder/` (webpack + sass) compiles
  to `dist/builder.{js,css}` and auto-copies them to the git-ignored
  `public/page_builder_assets/` which the layout serves. `npm run watch` mirrors every
  rebuild; `npm run smoke` runs the regression harness. Rebuild only when editing `src/`.
- **Chrome**: the editor shell is a compact dark/light Elementor-style surface driven by SCSS
  tokens. Bootstrap is allowed only for isolated legacy/admin controls outside the canvas.
- **Canvas**: elements render from the v2 store (never templates) and emit semantic HTML with
  `.ink-el-*` hook classes plus element-level styles from the store. The canvas CSS in
  `src/styles/canvas/` is compiled into the editor iframe and, hoisted into the body, into
  published output. Canvas/page typography comes from page/theme settings — editor CSS never
  recolors or resizes page text.
- **Design vocabulary**: the base design-kit stylesheet
  (`themes/standard/1_column_layout/ink-design-kit.css`) is imported at build time by
  `CustomCodeManager` and injected inline into the canvas + panel, and mirrored at
  `public/page_builder_theme/ink-design-kit.css` for published pages. **Custom CSS/JS is a
  builder capability** (`builder.customCode`, Code tab): injected live into the canvas,
  persisted with the page (`custom_css`/`custom_js`), rendered ahead of the body on publish.
- **Designs are data, not markup**: a page's design is stored as the recursive v2 store
  (editable elements), the rendered HTML (`.ink-el-*` markers), and custom CSS/JS. Restyling
  the canvas CSS only changes how the canvas *looks*; it never touches stored data, so no
  design is ever lost.

**Ownership (mental model)**: the Ink Builder OWNS the design vocabulary — the `.ink-el-*`
hook classes, the canvas stylesheets, the Ink element registries, and the renderer. The
Copilot is a thin AI that RIDES on the builder: it composes real builder element stores that
render 100% editable with builder markers, and puts its per-design styling in the page's
custom CSS. Everything the Copilot can emit must be reproducible by a human with the raw
builder — via the Elements library, the section-structure presets, or the Code tab — so the
builder is genuinely capable without AI, and the AI only automates what already exists.

Regression safety: `bin/rails builder:smoke` (Node/CDP harness in
`scripts/builder_smoke_test.js`) exercises builder load, real drag & drop, store
reconstruction, editability, panel routing, Structure, themes, the media picker, Clear, code
mode, the Design/Preview toggle, the classic-editor preview, publish cleanliness, and console
errors. Run it after any builder/template/layout change.

