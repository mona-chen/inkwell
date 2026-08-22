# Ink Builder port audit

This document is the implementation ledger for source-backed Magic UI and Elementor parity. A component is only marked **complete** when its structure, defaults, responsive behavior, motion, controls, persistence, preview, and published rendering match the referenced source.

## Magic UI components currently exposed

| Ink component | Reference | Status | Remaining differences |
| --- | --- | --- | --- |
| Aurora Text | `references/magicui/apps/www/registry/magicui/aurora-text.tsx` and `aurora-text-demo.tsx` | Substantially matched | Add reusable inline composition so Aurora Text can sit inside any heading rather than requiring the demo heading wrapper. |
| Retro Grid | `references/magicui/apps/www/registry/magicui/retro-grid.tsx` and `retro-grid-demo.tsx` | Partial | CSS fallback, props, frame, and demo are present. Port the WebGL renderer, context recovery, visibility pausing, DPR handling, and computed light/dark color resolution. |
| Bento Grid demo | `references/magicui/apps/www/registry/example/bento-demo.tsx` | Partial | Grid/card geometry and exact content are present. The child components below still need source parity. |
| Marquee | `references/magicui/apps/www/registry/magicui/marquee.tsx` | Substantially matched | Persisted reverse, vertical, repeat, duration and hover pause are implemented. Final visual snapshot tuning remains. |
| Animated List | `references/magicui/apps/www/registry/magicui/animated-list.tsx` | Substantially matched | Staged scale/opacity insertion, ordering and delay are implemented in normal CSS. Exact Motion spring/layout interpolation remains. |
| Animated Beam | `references/magicui/apps/www/registry/magicui/animated-beam.tsx` | Substantially matched | Uses measured logo nodes, ResizeObserver paths, per-beam gradients and persisted duration/colors/path/curvature/reverse/endpoint offsets. Exact Motion easing and finite-repeat controls remain. |
| Calendar demo | `references/magicui/apps/www/components/ui/calendar.tsx` | Partial | Real month generation, selected state, caption and navigation chrome are present. Interactive navigation, outside days, focus states and full accessibility behavior remain. |

Pricing, FAQ, Team, Stats, Testimonials, Spotlight cards, CTA, and Image + Text are Ink page sections. They are intentionally categorized under **Sections**, not **Magic UI**, because they are not direct registry ports.

## Elementor architecture adopted

Source references:

- `references/elementor/includes/elements/container.php`
- `references/elementor/includes/controls/groups/flex-container.php`
- `references/elementor/includes/controls/groups/grid-container.php`
- `references/elementor/modules/atomic-widgets/elements/`
- `references/elementor/includes/managers/controls.php`

Implemented foundation:

- Nested semantic `ContainerElement`.
- Flexbox or grid display mode.
- Full-width or boxed content width.
- Responsive desktop/tablet/mobile inherited values.
- Width, boxed width, and minimum height with units.
- Row, column, reversed directions.
- Justify content, align items, wrapping and align content.
- Independent row/column gaps with units.
- Overflow and semantic HTML tag.
- Padding and background controls.
- Container-query rendering so editor width, preview width and published width use one contract.

## Elementor control compatibility

| Elementor control | Ink status |
| --- | --- |
| Text, Textarea | Existing `TextControl`; needs single-line/textarea distinction and validation schema. |
| Number | Available through responsive size/gap controls; standalone number control pending. |
| Select | Existing `DropdownControl`/`EffectControl`; consolidate into one schema-driven select. |
| Switcher | Existing `CheckboxControl`; needs consistent boolean persistence. |
| Button | Pending generic action control. |
| Hidden | Persistence supported; formal hidden-control type pending. |
| Heading, Raw HTML, Notice, Alert, Divider | Pending panel-only presentation controls. |
| Section, Tab, Tabs | Existing tab managers are hard-coded; schema-driven control sections pending. |
| Color | Existing `ColorPickerControl`; alpha/global color support pending. |
| Media | Existing `ImageControl`; generalized media/file model pending. |
| Slider | Existing range controls; unit-aware consolidated slider pending. |
| Dimensions | Existing padding/margin control; units, linking and responsive inheritance pending. |
| Choose / Visual Choice | Responsive select exists; icon/visual segmented choice UI pending. |
| WYSIWYG | Existing `RichTextControl`; sanitize and schema integration pending. |
| Code | Page custom code exists; reusable code-control type pending. |
| Font | Existing font family/weight/size controls; unified typography group pending. |
| Image Dimensions | Pending dedicated intrinsic/crop sizing control. |
| URL | Text URL controls exist; target, rel, dynamic source and validation pending. |
| Repeater | Several specialized list controls exist; generic nested repeater schema pending. |
| Icon / Icons | Social icons exist; general icon picker and SVG source pending. |
| Gallery | Media gallery picker exists; generic gallery control pending. |
| Structure | New Container provides the model; visual structure picker pending. |
| Date Time | Pending. |
| Box Shadow / Text Shadow | Pending grouped controls. |
| Animation / Hover / Exit Animation | Effect controls exist; timeline and state variants pending. |
| Gaps | Implemented as `ResponsiveGapsControl`. |

## Elementor element/widget compatibility

### Atomic fundamentals

| Elementor element | Ink status |
| --- | --- |
| Div Block | Container can render `div`; dedicated lightweight Div Block pending. |
| Flexbox | Implemented by `ContainerElement`. |
| Grid | Container grid display exists; tracks, auto-flow and item-placement controls pending. |
| Heading | Existing H1–H5 elements; consolidate into one semantic Heading element. |
| Paragraph | Existing paragraph element. |
| Image | Existing image element; object fit/position and responsive source controls pending. |
| Button | Existing button element; interaction states and icon placement pending. |
| SVG | Pending dedicated safe SVG element. |
| Divider | Pending. |
| Accordion | Pending accessible atomic accordion. |
| Background Video | Existing background image only; pending. |
| Self-hosted Video | Existing video element; source/poster/tracks parity pending. |
| YouTube | Existing YouTube element; privacy and player controls parity pending. |
| Form | Existing individual controls; form container/actions/validation pending. |

### Classic widgets

Existing or partial: Alert, Button, Heading, Image, Image Carousel, Icon List/List, Pricing Table, RSS, Social Icons, Table, Text Editor, Video, YouTube.

Pending source-backed ports: Accordion, Audio, Counter, Divider, Google Maps, HTML, Icon, Icon Box, Image Box, Image Gallery, Menu Anchor, Progress, Rating, Read More, Shortcode, Sidebar, Spacer, Star Rating, Tabs, Testimonial, Toggle, and WordPress widget host.

## Acceptance criteria for each port

1. Reference source and demo are named in the implementation or test.
2. Default content and props match upstream.
3. Component is a first-class persisted element, not a visual variant switch.
4. All meaningful upstream props have controls.
5. Editor overlays do not alter geometry.
6. Desktop, tablet and mobile behavior is container-relative.
7. Preview and published rendering use the same normal CSS.
8. Motion supports reduced-motion preferences.
9. Keyboard and screen-reader behavior matches the semantic component.
10. A regression test verifies persistence, controls, rendering and absence of console errors.
