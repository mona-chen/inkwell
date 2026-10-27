module RendersPublicPage
  extend ActiveSupport::Concern

  private

  def render_public_page(page)
    @page = page
    @head_meta = Inkwell::Hooks.filter(:head_meta, [], post: page)
    if page.live_render_mode == "original_import" && page.original_import_available?
      render html: ImportedSites::Document.new(page, head_meta: @head_meta, origin: request.base_url).render.html_safe,
             layout: false, content_type: "text/html"
    else
      render template: "pages/#{page.template}", locals: { page: page }
    end
  rescue ActionView::MissingTemplate
    render "pages/default", locals: { page: page }
  end
end
