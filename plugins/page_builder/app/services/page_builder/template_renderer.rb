module PageBuilder
  # Renders a page designated as a content-type template (single_post / archive / index) in
  # place of the theme's default template. The template's own builder HTML is ERB; dynamic
  # `{{ post.* }}` tokens resolve through the `post:` local, and `{{ page.* }}` through the
  # controller's `@page` (set to the current item by the caller).
  module TemplateRenderer
    module_function

    def render(template_page, view_context:, locals: {})
      return "".html_safe unless template_page

      Array(template_page.content_blocks).map do |block|
        type = block["type"]
        data = block["data"] || {}
        if type == "page_builder"
          view_context.render(PageBuilder::BuilderBlockComponent.new(data: data, locals: locals))
        elsif (component = BlockRenderer::REGISTRY[type])
          view_context.render(component.new(data: data))
        end
      end.compact.join.html_safe
    end
  end
end
