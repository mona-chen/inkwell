class PagesController < ApplicationController
  before_action :activate_theme

  def show
    @page = Current.site.pages.published.friendly.find(params[:id])
    @head_meta = Inkwell::Hooks.filter(:head_meta, [], post: @page)
    if @page.live_render_mode == "original_import" && @page.original_import_available?
      response.headers["Content-Security-Policy"] = ""
      return render html: @page.original_import_html.html_safe, layout: false, content_type: "text/html"
    end
    render template: "pages/#{@page.template}", locals: { page: @page }
  rescue ActionView::MissingTemplate
    render "pages/default", locals: { page: @page }
  end

  private

  def activate_theme
    ThemeManager.activate_for_request!(self, Current.site.active_theme)
  end
end
