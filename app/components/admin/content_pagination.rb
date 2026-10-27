module Admin
  class ContentPagination < ApplicationComponent
    def initialize(collection:, kind:, status:, q:)
      @collection, @kind, @status, @q = collection, kind, status, q
    end
    def view_template
      return unless @collection.total_pages > 1
      nav(class: "mt-5 flex flex-wrap items-center justify-between gap-3 text-sm", aria: { label: "Content pagination" }) do
        if @collection.prev_page
          render Button.new("Previous", href: path(@collection.prev_page), variant: :outline, size: :sm)
        else
          span
        end
        span(class: "text-xs text-muted-foreground") { "Page #{@collection.current_page} of #{@collection.total_pages} · selections apply to this page" }
        render Button.new("Next", href: path(@collection.next_page), variant: :outline, size: :sm) if @collection.next_page
      end
    end
    private
    def path(page)
      "/admin/#{@kind}?#{ { page: page, status: @status, q: @q }.compact.to_query }"
    end
  end
end
