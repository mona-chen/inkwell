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
    "rich_text" => Blocks::RichTextComponent,
  }

  # Block type → editor partial (defaults to admin/posts/blocks/<type>). Plugins register
  # their own editor partials so their blocks render in the post/page editor too.
  EDITOR_PARTIALS = {}
  # Partial names whose `<template>` tags the core editor renders, letting plugin block types
  # participate in the "+ Add block" picker and slash menu.
  TEMPLATES_PARTIALS = []

  class << self
    def register(type, component_class)
      REGISTRY[type.to_s] = component_class
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
