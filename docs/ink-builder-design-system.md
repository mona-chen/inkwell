# Ink design system: tokens, sections, themes

A page's design in Ink is data, not markup. It is four things:

1. **Tokens** — one validated value model (`--ink-t-*` custom properties plus the page theme) that
   every colour, type, shape, spacing and motion decision reads from.
2. **The design-system stylesheet** — the archetype vocabulary, the per-section rhythm and the
   component states, generated from the tokens.
3. **Sections** — named archetypes that emit real, editable element trees.
4. **Authored CSS/JS** — the Code tab, unchanged.

All four live in the v2 store (elements), the page's `custom_css`/`custom_js`, and page settings.
Nothing here is model-only: every composition the Copilot can produce is reproducible by a human
through the Elements library, the Sections group, the Theme controls and the Code tab.

## Tokens

Source: `plugins/page_builder/app/builder/src/core/designTokens.js` (shared with the importer through
`scripts/design-tokens.js`).

- `normalizeTokens(raw)` is the single constructor. It clamps every number and only accepts hex
  colours, a safe font-stack shape, and a `cubic-bezier()`/keyword easing — so neither a model nor a
  captured stylesheet can break out of the token vocabulary.
- `tokenVariables(tokens)` emits the custom properties (`--ink-t-bg`, `--ink-t-accent`,
  `--ink-t-radius`, `--ink-t-content`, `--ink-t-duration`, …) plus `--ink-*` aliases.
- `themeSettings(tokens)` maps the same object onto the page theme the Site Settings panel edits, so
  the panel controls and the stylesheet can never disagree.
- `applyDesignTokens({runtime, customCode}, tokens, {label, commit})` writes the theme *and* the token
  block, history-aware, and rewrites every token block on the page (an imported page carries one from
  the capture).
- `ensureDesignCss(css, tokens)` installs the stylesheet exactly once.

Presets (`THEME_PRESETS`) are starting points, not locks: `editorial`, `product`, `aurora`, `mono`,
`warm`. Site Settings → **Design language** applies one; the colour/type/shape controls below keep
editing the same tokens.

`tokensFromEvidence(viewports)` derives a design language from a captured site: the darkest painted
area becomes the background, body copy becomes the type scale, a brand fill becomes the accent. It
rejects the browser's default link blue and Framer's `… Placeholder` fonts.

## The design-system stylesheet

`designCss(tokens)` returns one stylesheet:

| Layer | Contents |
| --- | --- |
| token block | `:root{--ink-t-*}` |
| `ARCHETYPE_CSS` | the component vocabulary: shell, stack, row, grid, card, button, media, display, price, faq item, nav links |
| `SECTION_CSS` | one modifier per section (`ink-arch-hero`, `ink-arch-blog-list`, …) so a page reads as a rhythm |
| `COMPONENT_CSS` | behaviour that is pure CSS: the monthly/yearly price switch and the 3D orbit deck |

Every rule is scoped to `.ink-canvas-root`, which the canvas and the published body both carry, so the
vocabulary never leaks into editor chrome. The stylesheet is page custom CSS, which means it is
versioned with the design, visible in the Code tab, and editable by hand.

**Invariant**: every `ink-arch-*` class an archetype emits is defined in that sheet.
`scripts/section-archetypes.test.js` walks every archetype and variant against the real CSS, so a
section can never ship an unstyled class.

## Sections (archetypes)

Source: `plugins/page_builder/app/builder/src/core/sectionArchetypes.js`. An archetype is a pure
function `build(variant, options) -> element spec`; `buildSection` returns
`{name, variant, role, spec}` and `composePage(names, options)` returns `{children, css}`.

| Archetype | Role | Variants | Emits |
| --- | --- | --- | --- |
| `nav` | nav | inline | nav container, links, action; `sticky` capable |
| `hero` | hero | split, centered, display | display heading, lede, actions, media |
| `logos` | content | marquee, row | marquee or row of marks |
| `features` | features | cards, grid, bento | cards or a native bento grid |
| `stats` | content | row | counters |
| `gallery` | content | grid, wide | images |
| `testimonials` | testimonials | cards | testimonial elements |
| `pricing` | pricing | switch, tiers | tiers + **real component states** for monthly/yearly |
| `faq` | faq | accordion | native `timeline-accordion` |
| `team` | content | grid, orbit | cards, or a **3D orbit motion group** |
| `blogList` | blog | grid, list | `query-loop` bound to posts with an editable card |
| `blogPost` | content | article | `post-content` |
| `profile` | content | author | author bindings + their posts |
| `cta` | cta | banner | closing copy + actions |
| `contact` | form | form | inputs + textarea + send |
| `footer` | footer | columns | link columns + legal line |

Two entry points, one code path:

- **Human**: Elements → **Sections** (first group) — click a tile, or drag it onto the canvas.
- **Copilot**: `list_archetypes`, `compose_page`, `compose_section`, `set_design_tokens`.

Both emit `runtime.events.emit('archetype:insert', …)`; `BuilderV2#insertArchetype` materializes the
tree with `elementSpec.materializeSpec` (the same helper `append_tree` uses, with the real registry's
acceptance rules) and records **one** history command that inserts the tree *and* installs the design
system — so undo removes both, and a section dropped into an empty page cannot render as a bare box.

## Behaviour that ships inside a section

- **Pricing switch** — the section root declares `stateNames: ['monthly','yearly']`; the two buttons
  carry `setState` interactions targeting `.ink-arch-pricing-<uid>`; `COMPONENT_CSS` swaps the price
  line from `[data-ink-state]`. It works in Design, in Preview and in published output with no JS.
- **Team orbit** — the deck is an `orbit3d` motion group and each card carries a keyframe cycle that
  closes on itself; the same shape the importer reconstructs from a captured site.
- **Blog list / post / profile** — `query-loop`, `post-content` and author bindings, so those
  sections are live data, not pictures.

## Templates

Page templates are a registry (`Page::DEFAULT_TEMPLATE_ROLES`): `single_author`, `single_post`,
`archive`, `index`. Plugins extend it with the `:page_template_roles` filter and prefix their roles
(`commerce.single_product` is the documented example in the plugin docs). The `blogList`, `blogPost`
and `profile` archetypes are the section vocabulary those roles are built from.

## Extending the system

- **A variant**: add it to `variants` and branch inside `build`. The vocabulary test checks every new
  variant's types, settings and classes.
- **A new archetype**: add the definition; give it a `role` and a section class, and add the class to
  `SECTION_CSS`.
- **A preset**: add a `THEME_PRESETS` entry; Site Settings picks it up automatically.
- **A class**: define it in `ARCHETYPE_CSS`/`SECTION_CSS` — an undefined `ink-arch-*` class fails CI.

Guards: `node --test scripts/*.test.js` (token model, archetype vocabulary, importer inference),
`npm run build`, and `bin/rails builder:smoke` (inserts every library section through the real
runtime, drags a section in, and checks the chrome contracts).

## The inspector

The settings panel is an author's tool, so it reads in an author's vocabulary rather than a CSS
property dump. `PanelManager.SECTION_GROUPS` maps every section an element definition declares onto
one of a small fixed set of groups:

`Content · Layout · Typography · Appearance · Transform · Responsive · Component · Interaction ·
Motion · Advanced`

- Element definitions keep declaring `section` names; the panel decides which group they live in, so
  a new control never has to know the IA. Sections an element type invents for itself fall back to
  their tab's group (`content`/`style`/`advanced`).
- Groups are the first level and carry the collapse state; sections are the second. Only the groups
  an author reaches for constantly start open (`content`, `layout`, `appearance` — see
  `OPEN_GROUPS`), which is what keeps a 14-bucket drawer from turning into an endless list.
- Nothing is named "Additional Options" or "Decorations": `overflow` lives in Layout, `tag` in
  Semantics, `shape-divider` in Shape divider.
- One **state selector** sits under the layer name and drives every state-aware section, instead of a
  repeated "Normal" dropdown under each heading. It also previews component states (`state:open`) on
  the canvas. `restoreFocusState` re-opens the group holding the control being edited, so a live
  re-render never drops the keyboard behind a collapsed group.

The control vocabulary that sits inside those sections:

- **Scrubbable value fields** (`valueInput.js`) — drag the label, type arithmetic (`12*2`,
  `100% - 20`, `50%` of the current value), arrow-step with Shift (coarse) / Alt (fine); nonsense is
  refused with a reason rather than committed as `NaN`.
- **Mixed values** — a control shared by several selected layers reads *Mixed* until one value is
  written, which then applies to every layer of that type.
- **Per-control menu** — copy, paste, reset, and a one-click section reset (right-click or the row
  trigger).
- **Panel search** — filters the settings on screen and names the tab that matches when this one
  does not.
- **Identity** — every layer carries class and ID controls (`Custom attributes`), which the renderer
  already applied to every node; they are how custom CSS, anchors and interactions target a layer.
- **Grid tracks** (`gridTracks.js`) — columns are edited as tracks with a count stepper, a
  proportional rail and per-track units; unknown syntax (`subgrid`, `auto-fit`, `calc()`) round-trips
  verbatim.
- **Motion** — the first view is the effect in words ("Fade + Move · 800ms") with a Preview button;
  iterations, direction, easing and the raw keyframe timeline stay under one *Advanced* disclosure.
- **Easing** — preset-first, with designer chips (Smooth · Snappy · Spring · Bounce · Custom) over a
  drawable bezier, and spring physics behind a `?`. The popover is viewport-pinned
  (`easingEditor` → `positionBody`) so it can be wider than the sidebar it opens from.
- **Target picker** — an interaction that targets a selector asks you to click the layer on the
  canvas and then reports what the selector currently resolves to, in words.
- **Agent scope** — the Copilot composer names what it will change (`Editing Hero / Content`) and
  adjusts its placeholder to the selected layer, so the Agent tab is tied to the selection rather
  than standing beside it.

Refinements that keep the panel from reading as a stack of forms:

- **No duplicated titles.** A section named after its own group (`Content` under CONTENT) keeps its
  place in the DOM as the grouping anchor but drops the second title (`data-redundant`), so its
  controls continue the group instead of restating it.
- **Sections are keyed by tab and name.** A section belongs to the group its tab implies, so `Link`
  is *Content › Link* where it holds a destination and *Appearance › Link* where it holds a colour —
  the two never collapse into whichever control came first. `Link` is therefore not pinned to the
  Interaction group: a link keeps its destination in Content and its styling with the element's
  style, and a heading's link colour sits with the rest of its typography.
- **Folded ancestor trail.** A deep selection shows `Page › Hero › … › Copy column › Headline stack`:
  the root and the branch the layer lives in, with the middle behind an ellipsis that opens every
  level. Every crumb is a button and carries the full name as a tooltip.
- **Percent-first values.** A control can declare `scale` and `suffix` (opacity: `min: 0, max: 1,
  step: 0.05, scale: 100, suffix: '%'`). The slider and its field speak percentages while the stored
  value stays 0–1, and the scaled step is rounded so the range input accepts it.
- **Explicit defaults instead of blanks.** Responsive selects carry a `default` (`overflow` →
  Visible, `align-self` → Auto), flex numbers show `0`/`1`, unset spacing sides place a `—`, and
  disabled fields state their value (`--ink-editor-muted`) rather than fading out of legibility.
- **Quiet where it repeats.** The per-control responsive switcher is borderless and low-contrast
  until hover/focus, and takes the accent only when that breakpoint actually stores an override
  (`is-overridden`). Disabled motion-group fields dim as a set (`is-off`), and the group's easing
  note is plain text until there is a group curve to drop.
- **Header/filter names say what they are.** `Showing all properties` frames the tab switcher,
  `Search properties` frames the panel search, and runtime hints (`Runs in Preview and on the
  published page…`) sit in an inset note (`ink-v2-note`).

## Importer: what it recovers, and what it does not

Recovered from a captured site (evidence-driven, never site-name-driven):

- the native DOM tree with imported layer names, deduplicated containers, and inferred structure
  roles/labels (`site-patterns.js`);
- component states + interactions, hover rules, motion, scroll-scrub, sticky and 3D orbit motion
  groups (`detectSticky` / `detectHoverGroup` / `detectScrubGroup`);
- the design language, as tokens (`tokensFromEvidence`), written ahead of the site's own CSS;
- additional origins (`allowed_origins`, `--include-origin`) so a site whose pages or assets live on
  a second host (e.g. `*.framer.ai`) is crawled instead of silently skipped;
- an **import report** stating which routes were skipped and which behaviours could not be
  reconstructed from evidence.

Not reconstructed: hand-authored animation choreography (multi-element timelines), and any
behaviour the captured page only expressed through a bundler's runtime. Those are surfaced in the
report rather than faked.
