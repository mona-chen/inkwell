# Elementor editor port matrix

Ink Builder treats the checked-in Elementor repository as the behavioral and visual reference.
The target is parity through Ink's v2 document/runtime APIs, without WordPress, PHP-generated
templates, Backbone, Marionette, jQuery, or jQuery UI runtime dependencies.

Primary references:

- `references/elementor/includes/controls/`
- `references/elementor/includes/editor-templates/`
- `references/elementor/assets/dev/js/editor/controls/`
- `references/elementor/assets/dev/js/editor/elements/views/behaviors/`
- `references/elementor/assets/dev/scss/editor/panel/`
- `references/elementor/assets/dev/scss/editor/preview/`
- `references/elementor/assets/dev/scss/editor/navigator/`
- `references/elementor/assets/dev/scss/frontend/widgets/` (frontend widget defaults)

## Editor behavior

| Contract | Ink status |
| --- | --- |
| Fixed ~280px left panel and isolated preview iframe | Ported; dark panel, resizable/collapsible |
| Desktop/tablet/mobile preview widths | Ported with fit-to-width stage scaling and framed device viewports |
| Dark responsive preview stage | Ported; centered page frame on a neutral stage |
| Element hover/selection outline | Ported; per-kind outlines (section/column dashed/container/widget) and toolbars |
| Floating element edit toolbar | Ported; revealed on hover/selection only |
| Empty page/container add affordance | Ported; full-width dashed insertion surface with 40×40 actions and a wide visual structure-preset gallery (state-based, Elementor `e-con-select-preset`) |
| Nested drag/drop intents | Ported; axis-aware before/after/inside with a visible drop line |
| Real cross-document drag & drop | Ported; blank-root, empty-container, before/after, reparent, and cancellation paths covered by real pointer tests |
| Column resize | Ported; per-column handles with live percentage feedback that commits real column structures |
| Context menu: edit/copy/paste/duplicate/delete | Ported |
| Recursive Structure panel and selection sync | Ported as a floating "Structure" panel toggled from the top bar; recursive tree with connector lines, expand/collapse persistence, before/after/inside drag reorder/reparent, visibility/lock toggles, context menu (duplicate/copy/paste/rename/delete), hover + scroll-into-view sync, keyboard nav, dock/position/size persistence |
| Undo/redo command history | Ported; History routed screen with jump-to-state |
| Inline text editing | Ported for text-bearing elements with history support |
| Canvas zoom, custom width/height, resize handles | Ported |
| Panel resize/collapse | Ported |
| Multi-select, copy/paste styles, reset styles | Ported with Shift/Cmd selection and one-command bulk delete |
| Finder, keyboard shortcut modal, revision history UI | Finder ported (Cmd/Ctrl+K) and inserts into the selected container; shortcut reference modal ported (?); History panel ported (Actions + jump-to-state) |

## App bar + panel shell

| Contract | Ink status |
| --- | --- |
| Continuous dark app bar above panel and canvas | Ported (#0c0d0e) |
| Left group: logo, Add Elements, Page settings, History, Site settings | Ported |
| Center group: page name, responsive breakpoints (active state obvious) | Ported |
| Right group: Finder, Structure toggle (active state), Preview, Publish, actions menu | Ported; Clear and Close live in the menu, not prominent |
| Dark chrome tokens in builder.css | Ported (--ink-editor-*) |
| Left panel routed screens, no peer tabs | Ported: Elements / Edit element / Site Settings / History |
| Navigator absent from library tabs | Removed; Structure is the floating panel |
| History + Site Settings opened from top-bar actions | Ported |
| Bootstrap removed from editor layout markup | Ported; layout uses semantic classes; canvas stays Bootstrap-free |

## Layout model

| Contract | Ink status |
| --- | --- |
| Full-width versus boxed content | Ported on section and container (`layout` control + inner wrapper) |
| Content width (site setting, default 1140px) | Ported via `--ink-content-width`; boxed inners cap at `min(100%, var(...))` |
| Page gutters | Ported via `--ink-page-gutter` applied to the canvas root |
| Section/container structure presets | Ported (10 presets, widths + column reconciliation) |
| Elementor column grid | Ported: flex row (`nowrap`), width-percentage basis, gap absorbed by shrink; stacks to 100% on mobile |
| Nested containers and inner sections | Ported |
| Widget spacing | Ported via container/column gap (20px default) |

## Control types

| Elementor type | Ink status |
| --- | --- |
| text, textarea, number, date-time, code | Ported |
| select, select2, font, animation, exit-animation, hover-animation | Ported |
| choose, visual-choice, structure | Ported; choose renders icon glyphs for icon options; structure renders presets and reconciles columns |
| typography | Ported as a single popover (font family via curated Google Fonts, size, weight, style, transform, decoration, line-height, letter-spacing); Google Fonts are @import'd into compiled CSS so they ship with published pages |
| heading size presets | Ported (`ink-size-*`: small 15 / medium 19 / large 29 / xl 39 / xxl 59 px) |
| color | Ported with document-global palette and alpha UI |
| switcher | Ported |
| slider | Ported |
| dimensions, image-dimensions | Ported |
| gaps | Ported with linked/unlinked row/column gap |
| heading, divider, hidden, raw-html, notice, alert, button | Ported |
| URL | Ported with target, nofollow, and custom attributes |
| media | Ported with preview, upload, library selection, and removal |
| icon, icons | Ported with Material Symbols plus the Phosphor and Lucide SVG libraries (library tabs, inline SVG rendering, `lucide:name`/`phosphor:name` value format); Material names stay migration-safe |
| gallery | Ported with thumbnails, incremental selection, removal, and clear |
| repeater | Ported with add, edit, duplicate, remove, and reorder actions |
| box-shadow, text-shadow | Ported with structured panel UI and CSS serialization |
| background (color/image/gradient/size/position/repeat) | Ported as a unified popover control (Elementor-style Classic/Gradient surface) |
| css-filters, text-stroke | Ported |
| Normal/Hover/Focus states | Ported for state-capable controls (state switcher threads into value buckets) |
| Conditions | Ported with AND/OR/not, multi-value arrays, and `__not_empty__` |
| {{WRAPPER}}-style descendant selectors | Ported via `styleMap` `selector` descriptors AND the element part/selector contract: every element may declare `selectors` (named parts → CSS hooks) and style controls declare the `part` + CSS `property` they affect; StyleEngine emits `.ink-el-<id> <part>` rules and drops/validates unknown parts at registration |
| WYSIWYG | Ported with a formatting toolbar and live active states |
| popover-toggle | Ported |
| tabs, section | Ported with collapsible control sections |
| responsive switcher per control | Ported (per-label device popover wired to the appbar) |
| WP widget | Not portable or applicable; replace with Ink plugin-element adapter |

## Primitive parity status

| Element | Status |
| --- | --- |
| Button | Size scale (xs–xl), icon + placement, alignment, hover/focus states, inner padding, CSS ID/classes |
| Heading | Link, hover/focus color, text shadow/stroke, blend mode, size presets, CSS ID/classes |
| Image | Caption/figure, link, alignment, object fit/position, hover filters, border/radius states |
| Icon | Size, color states, rotation |
| Divider | Alignment, weight, gap |
| Text Editor / Spacer / remaining primitives | Partial — no drop cap/columns yet; further per-widget parity pending |
| Common Advanced | CSS ID/classes/custom-attributes on primitives; motion effects/transforms/masks pending |

## Composite & interactive widget parity

Every composite widget is a native v2 element (repeater/gallery controls, semantic markup,
canvas CSS). Interactive behavior ships with the widget: a self-contained behavior runtime
(`data-ink-widget-runtime`) is emitted into the canvas root, delegates on the iframe document
(capture phase), and survives into published output — so tabs, carousels, and lightboxes work
in the editor and on the published page with zero external JS.

| Widget | Ink status |
| --- | --- |
| Tabs | Click + keyboard (arrows/Home/End) tab switching, ARIA roles, hidden panels |
| Accordion / Toggle | Native `<details>/<summary>` — interactive without JS |
| Image Carousel | Slide track with prev/next arrows, dot indicators, autoplay (interval), loop; navigation style setting |
| Image Gallery | Responsive grid + lightbox (open/close, prev/next, Esc/backdrop) |
| Social Icons | Repeater of icon/label/URL links |
| Testimonial / Counter / Progress / Rating / Alert / Audio / Video / Map | Static render from settings; no JS required |

## Remaining gaps (honest)

- Composite widgets ship self-contained interactive behavior (tabs/carousel/lightbox);
  remaining composite parity is per-widget polish (e.g. gallery captions, carousel effects).
- The element part/selector contract is applied to image, heading, button, icon-box/image-box,
  progress, icon-list, counter, rating, testimonial, alert, tabs, accordion/toggle, and the
  container inner wrapper; the remaining schemas (spacer, map, audio/video, plugin-widget,
  Magic UI) are single-root and need only explicit `selectors` when part controls are added.
- Device × state value storage, inheritance/unset semantics, and the Classic/Gradient background
  model are implemented; the remaining audit items are per-control polish (token inheritance,
  full border-per-side, media metadata model).
- Control renderers are extracted into independent modules (`src/core/controls/`) with a uniform
  contract; parity fixtures per control are the next hardening step.
- WYSIWYG now runs the shared TipTap adapter (canonical JSON + schema-bound HTML + legacy
  fallback); Ruby-side allowlist parity and Visual/Code mode are pending.
- Modern Container is the primary layout element (Elementor flex/grid controls on the inner
  wrapper); legacy Section/Columns/Column are flagged `legacy` in the library. A full
  migration/serializer for old section stores is pending.
- Shape dividers (elementorShapes.js) vendor Elementor's GPL-2.0 SVG paths for parity only.
  Clean-room TODO: replace with original path geometry + own naming before any distribution
  that must not carry GPL — the ELEMENTOR_SHAPES contract is the only consumer-facing surface,
  so a drop-in replacement is safe.
- Magic UI visual parity intentionally deferred until the foundation is verified.

## Core element inventory

The v2 registry (registered by `inkFoundationElements.js`, `inkElements.js`, and
`inkMagicElements.js`) includes section, columns, column, container, div, heading, paragraph,
text editor, HTML, button, image, icon, icon box, image box, icon list, divider, spacer,
counter, progress, rating, testimonial, tabs, accordion, toggle, alert, audio, video, map,
image gallery, image carousel, social icons, menu anchor, read more, and an Ink plugin-widget
adapter. WordPress-only shortcode/sidebar execution is intentionally represented by the
extension adapter because PHP/WordPress runtime behavior is outside this builder.

## Publish output

| Contract | Ink status |
| --- | --- |
| Published pages stay fully styled | Ported: `getHtml` hoists base/elementor/magic/per-element CSS into the body so the head-stripping `BuilderBlockComponent` renderer keeps layout |
| Semantic, marker-free output | Ported: `data-ink-*`, `draggable`, `contenteditable`, editor-only nodes removed |
| No Bootstrap in the canvas or output | Ported |
| Custom CSS/JS render ahead of the body | Ported |

## Style architecture

| Contract | Ink status |
| --- | --- |
| Editor chrome split by domain (SCSS partials) | Ported: `src/styles/editor/_appbar.scss`, `_workspace.scss`, `_panel.scss`, `_controls.scss`, `_structure.scss`, `_overlays.scss`, `_responsive.scss` compiled via sass + MiniCssExtract into `dist/builder.css` |
| Canvas element styles split per element domain | Ported: `src/styles/canvas/_base.scss` (layout), `_typography.scss`, `_button.scss`, `_boxes.scss`, `_data.scss`, `_content.scss`, `_media.scss`, `_magic.scss` compiled into strings injected into the iframe and published body |
| Editor chrome tokens | Ported: `--ink-editor-*` in `_tokens.scss` with `[data-ink-theme="light"]` overrides |
| Dark/light chrome themes | Ported; menu toggle + localStorage persistence |
| Media picker | Ported; standalone picker page loads Tailwind (bounded tiles) + Stimulus and posts the selection back to the builder |
| Elementor widget default fidelity | Button `#818a91`/15px/12px·24px/radius 3px; icon-box centered 40px icon + 15px gap; counter 69px/600; progress 30px track; muted `#7a7a7a` descriptions; Elementor palette primaries |

This file is an implementation checklist, not a claim of completion. A row only becomes
"Ported" after it works through the v2 store, control panel, canvas renderer, responsive CSS,
history, save/reload, and publish output.

