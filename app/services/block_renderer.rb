# Renders a post/page's jsonb `content` array into HTML. Deliberately a strict allow-list
# dispatch to a registered ViewComponent per block `type` — there is no code path that
# executes arbitrary stored HTML/strings, which is the entire class of vulnerability that
# WordPress shortcodes and "custom HTML" widgets have chronically suffered from.
class BlockRenderer
  # Plugins register new block types here (e.g. a plugin's engine initializer calls
  # `BlockRenderer.register("newsletter_signup", Newsletter::SignupBlockComponent)`),
  # extending the editor and the renderer in one line, no core changes.
  REGISTRY = {
    "heading"   => Blocks::HeadingComponent,
    "paragraph" => Blocks::ParagraphComponent,
    "image"     => Blocks::ImageComponent,
    "quote"     => Blocks::QuoteComponent,
    "list"      => Blocks::ListComponent,
    "code"      => Blocks::CodeComponent,
    "separator" => Blocks::SeparatorComponent,
    "callout"   => Blocks::CalloutComponent,
    "button"    => Blocks::ButtonComponent,
    "rich_text" => Blocks::RichTextComponent
  }

  # Block type → editor partial (defaults to admin/posts/blocks/<type>). Plugins register
  # their own editor partials so their blocks render in the post/page editor too.
  EDITOR_PARTIALS = {}
  # Partial names whose `<template>` tags the core editor renders, letting plugin block types
  # participate in the "+ Add block" picker and slash menu.
  TEMPLATES_PARTIALS = []
  # Partial names rendered inside the block editor toolbar (next to "+ Add block"), letting
  # plugins inject editor controls — buttons, dialogs, and their Stimulus controllers.
  # Activation-aware: registered by on_activate, removed by on_deactivate.
  EDITOR_TOOLBAR_PARTIALS = []

  # Lucide icon (NitroKit::Icon name) per block type, shown in the "+ Add block" picker.
  # Plugins can register their own icon alongside a type.
  ICONS = {
    "heading"    => "heading",
    "paragraph"  => "pilcrow",
    "image"      => "image",
    "quote"      => "quote",
    "list"       => "list",
    "code"       => "code",
    "separator"  => "separator-horizontal",
    "callout"    => "info",
    "button"     => "mouse-pointer-click",
    "rich_text"  => "pen-line"
  }.freeze

  # Reusable block patterns shown in the editor's "+ Add block" picker. Each is
  #   { "title" => "...", "blocks" => [ { "type" => ..., "data" => ... }, ... ] }
  # with block hashes matching the stored jsonb shape, so a pattern insert is exactly a
  # normal block-array insert — no special-case data format. Plugins can append their own
  # with `BlockRenderer.register_pattern("name", "Title", [ { type: ..., data: ... } ])`.
  PATTERNS = {
    "hero" => {
      "title" => "Hero",
      "icon" => "sparkles",
      "blocks" => [
        { "type" => "heading", "data" => { "level" => 1, "text" => "Big headline here" } },
        { "type" => "paragraph", "data" => { "text" => "A short supporting line that tells the reader what this page is about." } },
        { "type" => "button", "data" => { "style" => "primary", "label" => "Get started", "url" => "https://" } }
      ]
    },
    "article-intro" => {
      "title" => "Article intro",
      "icon" => "newspaper",
      "blocks" => [
        { "type" => "heading", "data" => { "level" => 2, "text" => "Section title" } },
        { "type" => "paragraph", "data" => { "text" => "Opening paragraph for the section. Lead with the idea, then expand." } }
      ]
    },
    "pull-quote" => {
      "title" => "Pull quote",
      "icon" => "quote",
      "blocks" => [
        { "type" => "quote", "data" => { "text" => "A memorable quote that carries the post's argument.", "attribution" => "Name, title" } },
        { "type" => "paragraph", "data" => { "text" => "Follow-up paragraph unpacking the quote above." } }
      ]
    },
    "text-image" => {
      "title" => "Text + image",
      "icon" => "image",
      "blocks" => [
        { "type" => "paragraph", "data" => { "text" => "Supporting paragraph that frames the image." } },
        { "type" => "image", "data" => { "url" => "", "alt" => "", "caption" => "" } }
      ]
    },
    "steps" => {
      "title" => "Numbered steps",
      "icon" => "list-ordered",
      "blocks" => [
        { "type" => "heading", "data" => { "level" => 2, "text" => "How it works" } },
        { "type" => "list", "data" => { "ordered" => true, "items" => "First step\nSecond step\nThird step" } }
      ]
    },
    "cta-callout" => {
      "title" => "Callout + button",
      "icon" => "mouse-pointer-click",
      "blocks" => [
        { "type" => "callout", "data" => { "tone" => "info", "text" => "Key takeaway worth highlighting to the reader." } },
        { "type" => "button", "data" => { "style" => "primary", "label" => "Read more", "url" => "https://" } }
      ]
    }
  }.freeze

  class << self
    def register(type, component_class)
      REGISTRY[type.to_s] = component_class
    end

    def register_pattern(name, title, blocks, icon: nil)
      PATTERNS[name.to_s] = { "title" => title.to_s, "icon" => (icon || "sparkles"), "blocks" => blocks.map { |b| b.symbolize_keys.merge("data" => (b[:data] || {})) } }
    end

    def icon_for(type)
      ICONS[type.to_s] || "square"
    end

    def patterns
      PATTERNS
    end

    def register_editor_partial(type, partial)
      EDITOR_PARTIALS[type.to_s] = partial
    end

    def editor_partial(type)
      EDITOR_PARTIALS[type.to_s] || "admin/posts/blocks/#{type}"
    end

    def register_templates_partial(partial)
      TEMPLATES_PARTIALS << partial
    end

    def templates_partials
      TEMPLATES_PARTIALS
    end

    def register_editor_toolbar_partial(partial)
      EDITOR_TOOLBAR_PARTIALS << partial unless EDITOR_TOOLBAR_PARTIALS.include?(partial)
    end

    def unregister_editor_toolbar_partial(partial)
      EDITOR_TOOLBAR_PARTIALS.delete(partial)
    end

    def editor_toolbar_partials
      EDITOR_TOOLBAR_PARTIALS
    end

    def render(blocks, view_context)
      Array(blocks).map do |block|
        component = REGISTRY[block["type"]]
        next view_context.content_tag(:div, "Unknown block type: #{block['type']}", class: "text-red-500 text-sm") unless component

        view_context.render(component.new(data: block["data"] || {}))
      end.join.html_safe
    end

    def registered_types
      REGISTRY.keys
    end
  end
end
