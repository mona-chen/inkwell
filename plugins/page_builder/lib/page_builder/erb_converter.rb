module PageBuilder
  # Converts the friendly token syntax authors type in the Ink Builder into real ERB before the
  # page is saved. This is what lets a drag-and-drop build carry dynamic data:
  #
  #   {{ site.name }}            ->  <%= Current.site.name %>
  #   {{ page.title }}           ->  <%= @page.title %>
  #   {{ post.title }}           ->  <%= post.title %>
  #   {{ loop posts:3 }} ... {{ /loop }}  ->  <% Current.site.posts.published.limit(3).each do |post| %> ... <% end %>
  #
  # NOTE: the resulting ERB is stored verbatim and rendered as a live template on the front
  # end, so it is server-side code execution. The Ink Builder is admin-only by design — treat
  # it like a "custom code" block, never expose it to non-admin authors.
  class ErbConverter
    ROOTS = {
      "site" => "Current.site",
      "page" => "@page",
      "post" => "post",
    }.freeze

    LOOP_SOURCES = {
      "posts" => "Current.site.posts.published",
      "pages" => "Current.site.pages.published",
    }.freeze

    LOOP_VARS = {
      "posts" => "post",
      "pages" => "page",
    }.freeze

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
      out.gsub!(/\{\{\s*\/\s*loop\s*\}\}/, "<% end %>")
      out.gsub!(/\{\{\s*loop\s+(posts|pages)(?::(\d+))?\s*\}\}/) do
        source = LOOP_SOURCES[Regexp.last_match(1)]
        source += ".limit(#{Integer(Regexp.last_match(2))})" if Regexp.last_match(2)
        "<% #{source}.each do |#{LOOP_VARS[Regexp.last_match(1)]}| %>"
      end
      out.gsub!(/\{\{\s*(site|post)\.([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/) do
        "<%= #{ROOTS[Regexp.last_match(1)]}.#{Regexp.last_match(2)} %>"
      end
      out.gsub!(/\{\{\s*page\.([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/) do
        "<%= #{@document_root}.#{Regexp.last_match(1)} %>"
      end
      out
    end
  end
end
