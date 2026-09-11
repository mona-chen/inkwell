module PageBuilder
  # Converts the friendly token syntax authors type in the Ink Builder into real ERB before the
  # page is saved. This is what lets a drag-and-drop build carry dynamic data:
  #
  #   {{ site.name }}            ->  <%= Current.site.name %>
  #   {{ page.title }}           ->  <%= @page.title %>
  #   {{ post.title }}           ->  <%= post.title %>
  #   {{ loop posts:3 }} ... {{ /loop }}  ->  <% Current.site.posts.published.limit(3).each do |post| %> ... <% end %>
  #
  # Loop sources are a plugin-extensible registry (:builder_loop_sources); plugin loop
  # variables (e.g. `product`) resolve to the local loop variable in `{{ product.title }}`.
  #
  # NOTE: the resulting ERB is stored verbatim and rendered as a live template on the front
  # end, so it is server-side code execution. The Ink Builder is admin-only by design — treat
  # it like a "custom code" block, never expose it to non-admin authors.
  class ErbConverter
    class << self
      def convert(html, document_root: "@page")
        new(document_root).convert(html)
      end
    end

    def initialize(document_root = "@page")
      @document_root = document_root
    end

    def convert(html)
      out = html.to_s.dup
      loops = loop_definitions

      out.gsub!(/\{\{\s*\/\s*loop\s*\}\}/, "<% end %>")
      out.gsub!(/\{\{\s*loop\s+([a-zA-Z_][\w]*)(?::(\d+))?\s*\}\}/) do
        definition = loops[Regexp.last_match(1)]
        next Regexp.last_match(0) unless definition

        scope = (definition["scope"] || definition[:scope]).to_s
        var = (definition["var"] || definition[:var] || "item").to_s
        scope += ".limit(#{Integer(Regexp.last_match(2))})" if Regexp.last_match(2)
        "<% #{scope}.each do |#{var}| %>"
      end

      # Field tokens: `site`/`page` resolve to roots; any other source (e.g. a plugin loop
      # variable like `product`) resolves to a local variable of that name.
      out.gsub!(/\{\{\s*([a-zA-Z_][\w]*)\.([a-zA-Z_][\w.]*)\s*\}\}/) do
        source = Regexp.last_match(1)
        field = Regexp.last_match(2)
        root = case source
               when "site" then "Current.site"
               when "page" then @document_root
               else source
               end
        "<%= #{root}.#{field} %>"
      end

      # Embed the record's standard block-editor content at this spot (rendered via
      # BlockRenderer, page_builder block excluded to avoid recursion).
      out.gsub!(/\{\{\s*blocks\s*\}\}/, "<%= render_block_content(#{@document_root}) %>")
      out
    end

    private

    def loop_definitions
      PageBuilder::DataSources.loop_sources
    end
  end
end
