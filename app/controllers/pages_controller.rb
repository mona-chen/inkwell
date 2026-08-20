class PagesController < ApplicationController
  before_action :activate_theme

  def show
    @page = Current.site.pages.published.friendly.find(params[:id])
    render template: "pages/#{@page.template}", locals: { page: @page }
  rescue ActionView::MissingTemplate
    render "pages/default", locals: { page: @page }
  end

  private

  def activate_theme
    ThemeManager.activate_for_request!(self, Current.site.active_theme)
  end
end
