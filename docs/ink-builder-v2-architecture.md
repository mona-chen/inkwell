# Ink Builder v2 architecture

Ink Builder v2 is a page builder, not an evolution of the original email composer. The v1 `Page → Block → Grid → Cell → elementLists` hierarchy is retired as an editor contract. V2 follows the successful parts of Elementor's architecture while keeping Ink's implementation framework-independent and Rails-friendly.

## Reference map

The design is based on these local Elementor sources:

- Element models and recursive collections: `references/elementor/assets/dev/js/editor/elements/models/` and `elements/collections/elements.js`.
- Element type registry: `references/elementor/assets/dev/js/editor/elements/manager.js` and `elements/types/`.
- Settings model and control metadata: `references/elementor/assets/dev/js/editor/elements/models/base-settings.js`.
- Control stack and panel regions: `references/elementor/assets/dev/js/editor/views/controls-stack.js` and `regions/panel/`.
- Responsive editing: `references/elementor/assets/dev/js/editor/regions/responsive-bar/` and frontend breakpoints.
- Generated styles: `references/elementor/assets/dev/js/editor/utils/stylesheet.js` and `controls-css-parser.js`.
- Modern atomic elements and CSS conversion: `references/elementor/modules/atomic-widgets/elements/` and `css-converter/`.

We copy the architectural ideas, not Elementor's WordPress/PHP coupling, Backbone/Marionette runtime, global variables, or remote-render protocol.

## Non-negotiable rules

1. The document is a recursive element tree. Any element that declares child support may contain compatible children.
2. Element definitions are registered data and behavior, never a central switch statement.
3. Settings are plain values validated against control schemas. Controls render from schemas rather than each element manually constructing panel classes.
4. Style settings generate disposable scoped CSS. Editor overlays never alter component geometry.
5. Responsive values use one inheritance contract and one global device mode.
6. Every edit is a command and can participate in undo/redo.
7. Canvas, preview, and published output share one renderer and one style engine.
8. Editor chrome is isolated from canvas CSS. Bootstrap may remain in legacy chrome only while the v2 panel replaces it.
9. Templates and design kits are document fragments composed from registered elements, not bespoke layout modes hidden in Grid.
10. The v2 store is authoritative. V1 saved-page compatibility is not a requirement.

## V2 document contract

```json
{
  "version": 2,
  "type": "page",
  "settings": {
    "title": "Blank",
    "breakpoints": { "desktop": null, "tablet": 1024, "mobile": 767 },
    "theme": { "colors": {}, "typography": {}, "spacing": {} },
    "customCss": "",
    "customJs": ""
  },
  "children": [
    {
      "id": "stable-id",
      "type": "container",
      "settings": {},
      "styles": {
        "base": {},
        "tablet": {},
        "mobile": {},
        "hover": {},
        "focus": {}
      },
      "children": []
    }
  ]
}
```

`type` selects an element definition from `ElementRegistry`. `settings` affects content/behavior. `styles` contains design values. `children` is present only for elements whose definition accepts children. Editor-only state—selection, hover, open panel section, active device—is never persisted in the document.

## Element definition contract

Each registered definition supplies:

- `type`, `title`, `icon`, `category`, and search keywords.
- `defaults()` for settings/styles/children.
- `controls`, grouped into Content, Style, and Advanced sections.
- `acceptsChild(parent, child)` and optional `canBeChildOf` rules.
- `render(context, node)` returning semantic DOM.
- Optional lifecycle hooks: `mount`, `update`, `unmount`.
- Optional style schema mapping values to selectors and CSS declarations.

Container, Flexbox, Grid, Div, Heading, Paragraph, Image, Button, SVG, Divider and Spacer are foundation elements. Magic UI components build on the same contract and may expose lifecycle hooks for measured animation.

## Editor services

- `EditorDocument`: normalized tree, id index, traversal, insertion, movement, duplication and removal.
- `ElementRegistry`: definitions and creation. Plugins extend it without editing a switch.
- `CommandHistory`: execute/undo/redo transactions and coalesce live control input.
- `ControlRegistry`: maps schema types to panel control renderers.
- `ResponsiveManager`: active device, breakpoints, inheritance and preview width.
- `StyleEngine`: turns element style schemas into scoped CSS by breakpoint/state.
- `SelectionManager`: selected/hovered node ids and breadcrumb path.
- `PanelManager`: library, element controls, page settings, theme settings and navigator routes.
- `CanvasRenderer`: keyed recursive rendering, lifecycle cleanup and overlay coordinates.
- `DragDropManager`: tree-aware placement intents (`before`, `inside`, `after`) validated by definitions.

Services communicate through an event bus and commands, not globals. The temporary `window.builder` API is an adapter during implementation, not the v2 contract.

## Panel structure

The panel follows Elementor's useful separation:

- Elements: searchable categorized element library and reusable templates.
- Edit element: Content, Style, Advanced tabs generated from the selected definition.
- Navigator: full tree with rename, hide, lock, reorder and nesting.
- Page settings: document layout, SEO-level metadata, body background and custom code.
- Theme: global colors, typography, spacing, breakpoints and reusable style tokens.
- History: undo/redo timeline.

Controls use consistent rows, labels, help, responsive device indicator, reset/inherit state, conditions and validation. A control changes model data; it never reaches into arbitrary component DOM.

## Styling and responsiveness

Each element owns a stable `.ink-el-{id}` scope. The style engine emits one style node for the document, ordered desktop-first and then breakpoint overrides. Responsive values inherit from the next wider device when absent. State styles use explicit pseudo-state buckets. Global theme tokens resolve to CSS custom properties.

The active editor device changes only the canvas viewport and the responsive value being edited. It does not add design classes that alter the page differently from publication.

## Rendering lifecycle

1. A command updates the document tree.
2. The document emits a narrow change event with affected ids.
3. The renderer updates keyed nodes and calls lifecycle hooks.
4. The style engine regenerates affected scoped rules.
5. Selection overlays remeasure without entering document flow.
6. Serialization stores only the normalized document.

Published output uses the same element definitions and generated CSS. Editor helpers and lifecycle tooling are omitted.

## Implementation sequence

1. Core document/registry/events/history/responsive/style services.
2. Schema control renderer and panel routes.
3. Recursive canvas renderer, selection overlays and tree-aware drag/drop.
4. Foundation elements and design-token settings.
5. Design kit/template fragments.
6. Magic UI lifecycle components.
7. Remove v1 classes, globals and templates after parity tests pass.

