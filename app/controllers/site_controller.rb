# The public front-of-site controller: home page, and it's where ThemeManager gets engaged
# for every non-admin request.
class SiteController < ApplicationController
  before_action :activate_theme

  def home
    # If a static front page is configured (Settings → Reading → Homepage), render that
    # page's template — same as PagesController — instead of the posts archive.
    if Current.site.front_page?
      @page = Current.site.front_page
      @head_meta = Inkwell::Hooks.filter(:head_meta, [], post: @page)
      render template: "pages/#{@page.template}", locals: { page: @page }
      return
    end

    @posts = Current.site.posts.published.recent.limit(10)
    @head_meta = Inkwell::Hooks.filter(:head_meta, [], post: nil)
    render "site/home"
  end

  def feed
    @posts = Current.site.posts.published.recent.limit(20)
    render xml: render_to_string(partial: "site/feed", formats: [:xml]), layout: false
  end

  def sitemap
    @posts = Current.site.posts.published.order(published_at: :desc)
    @pages = Current.site.pages.published.ordered
    render xml: render_to_string(partial: "site/sitemap", formats: [:xml]), layout: false
  end

  private

  def activate_theme
    preview_theme = params[:preview_theme] if current_user&.admin?
    ThemeManager.activate_for_request!(self, preview_theme || Current.site.active_theme, preview: preview_theme.present?)
  end
end
