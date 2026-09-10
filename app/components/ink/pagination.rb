module Ink
  class Pagination < Component
    def initialize(pagy: nil, **html)
      @pagy = pagy
      @html = html
    end

    def view_template
      return if @pagy.nil? || @pagy.respond_to?(:last) && @pagy.last <= 1
      nav(class: "flex items-center gap-0.5 py-2", **@html, aria: { label: "Pagination" }) do
        render_page_links
      end
    end

    private

    def render_page_links
      return unless @pagy.respond_to?(:series)
      @pagy.series.each do |item|
        case item
        when Integer
          active = item == @pagy.page
          a(
            href: "?page=#{item}",
            class: "inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-md text-sm font-medium border transition-colors #{active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground bg-card"}"
          ) { item.to_s }
        when String
          span(class: "inline-flex items-center justify-center min-w-7 h-7 text-sm text-muted-foreground") { item }
        end
      end
    end
  end
end
