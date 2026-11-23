# The single catalog of conventional (non-Builder) content blocks. It is the contract shared
# by the theme renderer (ThemeRuntime::ContentHtml), the agent API (typed JSON schemas and
# the authoring guide) and the editor. Adding a block means adding it here first.
module ContentBlocks
  module_function

  INLINE = "Supports inline **bold**, *italic*, `code`, ~~strike~~ and [links](https://example.com)."

  def str(max = 2000, description = nil, **extra)
    { type: "string", maxLength: max }.merge(description ? { description: description } : {}).merge(extra)
  end

  def obj(properties, required = [])
    { type: "object", properties: properties, required: required, additionalProperties: false }
  end

  def list_of(item, max = 50, min = 0)
    { type: "array", items: item, maxItems: max, minItems: min }
  end

  # name => { label:, description:, schema:, example: }
  def catalog
    @catalog ||= {
      "rich_text" => {
        label: "Formatted text",
        description: "The main prose block. A TipTap/ProseMirror JSON document under `json` (doc → paragraph, heading(level 2–4), bulletList, orderedList, listItem, blockquote, codeBlock, horizontalRule, hardBreak, image, table/tableRow/tableHeader/tableCell; marks bold, italic, underline, strike, code, link{href}). Prefer several focused blocks over one huge document.",
        schema: obj({ json: { type: "object", description: "ProseMirror doc: { type: 'doc', content: [...] }" } }, %w[json]),
        example: { json: { type: "doc", content: [ { type: "paragraph", content: [ { type: "text", text: "Hello " }, { type: "text", text: "world", marks: [ { type: "link", attrs: { href: "https://ruut.chat" } } ] } ] } ] } }
      },
      "paragraph" => {
        label: "Paragraph",
        description: "A single paragraph. #{INLINE}",
        schema: obj({ text: str(10_000) }, %w[text]),
        example: { text: "Customers expect **fast** answers on the channel they already use." }
      },
      "heading" => {
        label: "Heading",
        description: "Section heading. Use level 2 for sections and 3 for subsections (the post title is the only h1). Headings get stable anchors and feed the table of contents.",
        schema: obj({ text: str(300), level: { type: "integer", minimum: 2, maximum: 4 }, anchor: str(80, "Optional custom anchor id, e.g. 'pricing'.") }, %w[text]),
        example: { level: 2, text: "Pricing compared" }
      },
      "image" => {
        label: "Image",
        description: "An image from the media library (upload with inkwell.media_upload first). Always write meaningful alt text.",
        schema: obj({ url: str(2000), alt: str(500), caption: str(1000, INLINE), credit: str(300), link: str(2000), size: { type: "string", enum: %w[content wide full] }, width: { type: "integer", minimum: 1 }, height: { type: "integer", minimum: 1 } }, %w[url alt]),
        example: { url: "/media/3/file", alt: "Ruut shared inbox showing WhatsApp and Instagram conversations", caption: "The shared inbox.", size: "wide" }
      },
      "table" => {
        label: "Table",
        description: "A real, accessible, responsive data table — use this for comparisons, pricing and specs, never an image of a table. Cells are short text; #{INLINE} A cell that is exactly ✓, ✗, yes, no or partial renders as an icon. `highlight` is the zero-based column to emphasise (e.g. your product).",
        schema: obj({
          caption: str(300, "Short accessible title for the table."),
          columns: list_of(str(200), 8, 1),
          rows: list_of(list_of(str(1000), 8, 1), 60, 1),
          highlight: { type: %w[integer null], minimum: 0, maximum: 7 },
          row_headers: { type: "boolean", description: "Treat the first column as row headers (default true)." },
          note: str(1000, "Footnote under the table, e.g. sources and date checked. #{INLINE}")
        }, %w[columns rows]),
        example: { caption: "Ruut vs Intercom at a glance", columns: [ "Feature", "Ruut", "Intercom" ], highlight: 1, rows: [ [ "Shared inbox", "✓", "✓" ], [ "TikTok messaging", "✓", "✗" ], [ "Starting price", "₦10,000/month", "From $19/seat/month" ] ], note: "Published pricing checked 23 November 2026." }
      },
      "takeaways" => {
        label: "Key takeaways",
        description: "A TL;DR box near the top of long posts. 3–5 crisp, self-contained points. #{INLINE}",
        schema: obj({ title: str(120), items: list_of(str(600), 8, 1) }, %w[items]),
        example: { title: "Key takeaways", items: [ "Ruut lists TikTok, Telegram and LINE as native channels.", "Intercom offers Slack and Discord." ] }
      },
      "callout" => {
        label: "Callout",
        description: "A highlighted note. Tones: info, tip, success, warning, danger. #{INLINE}",
        schema: obj({ tone: { type: "string", enum: %w[info tip success warning danger] }, title: str(160), text: str(3000) }, %w[text]),
        example: { tone: "tip", title: "Before you decide", text: "Ask each vendor for a **complete** quote including usage." }
      },
      "quote" => {
        label: "Quote",
        description: "A quotation. style 'pull' renders a large pull quote.",
        schema: obj({ text: str(2000), attribution: str(200), role: str(200), style: { type: "string", enum: %w[default pull] } }, %w[text]),
        example: { text: "We answered twice as many customers in the first month.", attribution: "Ada Obi", role: "Head of Support, Example Co", style: "pull" }
      },
      "list" => {
        label: "List",
        description: "Bulleted, numbered or checklist. `items` is an array (or newline-separated string). #{INLINE}",
        schema: obj({ items: { anyOf: [ list_of(str(1000), 100, 1), str(20_000) ] }, ordered: { type: "boolean" }, style: { type: "string", enum: %w[bullet number check] } }, %w[items]),
        example: { style: "check", items: [ "Shared inbox", "WhatsApp Business API", "Voice" ] }
      },
      "stats" => {
        label: "Stats",
        description: "2–4 headline numbers with labels.",
        schema: obj({ items: list_of(obj({ value: str(40), label: str(200), note: str(300) }, %w[value label]), 4, 1), source: str(500, INLINE) }, %w[items]),
        example: { items: [ { value: "70%", label: "lower cost per contact" }, { value: "3×", label: "faster resolution" } ], source: "Customer-reported results." }
      },
      "pros_cons" => {
        label: "Pros and cons",
        description: "Two-column pros/cons or 'choose X if / choose Y if' comparison. #{INLINE}",
        schema: obj({ pros_title: str(120), pros: list_of(str(600), 12, 1), cons_title: str(120), cons: list_of(str(600), 12, 1) }, %w[pros cons]),
        example: { pros_title: "Choose Ruut if", pros: [ "WhatsApp and TikTok matter" ], cons_title: "Choose Intercom if", cons: [ "You need Slack as a support channel" ] }
      },
      "faq" => {
        label: "FAQ",
        description: "Frequently asked questions. Renders an accessible accordion and FAQPage structured data. Answers: 1–3 sentences. #{INLINE}",
        schema: obj({ title: str(160), items: list_of(obj({ question: str(300), answer: str(3000) }, %w[question answer]), 20, 1) }, %w[items]),
        example: { title: "Frequently asked questions", items: [ { question: "Is Ruut a good Intercom alternative?", answer: "Yes, for teams that rely on WhatsApp and social messaging." } ] }
      },
      "cta" => {
        label: "Call to action",
        description: "An in-article call-to-action card. Use at most one or two per post.",
        schema: obj({ eyebrow: str(80), title: str(160), text: str(600, INLINE), primary_label: str(60), primary_url: str(2000), secondary_label: str(60), secondary_url: str(2000) }, %w[title primary_label primary_url]),
        example: { title: "Try Ruut free", text: "Bring every channel into one inbox in minutes.", primary_label: "Get started", primary_url: "https://app.ruut.chat/app/auth/signup", secondary_label: "Book a demo", secondary_url: "https://cal.com/ruut-csm" }
      },
      "embed" => {
        label: "Video embed",
        description: "YouTube, Vimeo or Loom video by its public URL. Other URLs render as a link card.",
        schema: obj({ url: str(2000), title: str(200), caption: str(600, INLINE) }, %w[url]),
        example: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Product walkthrough" }
      },
      "code" => {
        label: "Code",
        description: "A code sample with optional language and filename.",
        schema: obj({ code: str(50_000), language: str(40), filename: str(200) }, %w[code]),
        example: { language: "bash", code: "curl https://api.example.com" }
      },
      "button" => {
        label: "Button",
        description: "A standalone link button. style: primary or secondary.",
        schema: obj({ label: str(80), url: str(2000), style: { type: "string", enum: %w[primary secondary outline] } }, %w[label url]),
        example: { label: "See pricing", url: "/pricing", style: "primary" }
      },
      "separator" => {
        label: "Divider",
        description: "A horizontal divider between sections.",
        schema: obj({}),
        example: {}
      }
    }.freeze
  end

  def types = catalog.keys

  def schema_for(type)
    catalog.dig(type.to_s, :schema)
  end

  # A JSON schema for a block array. Each item's `data` is validated against its own type
  # with if/then (rather than oneOf) so validation errors point at the exact field, e.g.
  # `/blocks/3/data/rows`. `extra_types` admits plugin-registered blocks with free-form data.
  def blocks_schema(max_items: 500, extra_types: [])
    {
      type: "array",
      maxItems: max_items,
      items: {
        type: "object",
        properties: { type: { type: "string", enum: types + extra_types }, data: { type: "object" } },
        required: %w[type data],
        additionalProperties: false,
        allOf: catalog.map { |type, definition| { if: { properties: { type: { const: type } } }, then: { properties: { data: definition[:schema] } } } }
      }
    }
  end

  def guide
    catalog.map do |type, definition|
      { type: type, label: definition[:label], description: definition[:description], example: { type: type, data: definition[:example] } }
    end
  end
end
