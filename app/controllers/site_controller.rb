# The public front-of-site controller: home page, and it's where ThemeManager gets engaged
# for every non-admin request.
class SiteController < ApplicationController
  include RendersPublicPage

  before_action :activate_theme

  def home
    runtime = ThemePackages::Runtime.for(@current_theme)
    return if runtime&.render(self, "/")

    if @theme_preview && params[:theme_home] == "1"
      @posts = Current.site.posts.published.recent.includes(:author, :terms).limit(10)
      return render "site/home"
    end

    # If a static front page is configured (Settings → Reading → Homepage), render that
    # page's template — same as PagesController — instead of the posts archive.
    if Current.site.front_page?
      render_public_page(Current.site.front_page)
      return
    end

    imported_home = Current.site.pages.published.find_by(public_path: "/")
    return render_public_page(imported_home) if imported_home

    @posts = Current.site.posts.published.recent.limit(10)
    @head_meta = Inkwell::Hooks.filter(:head_meta, [], post: nil)
    render "site/home"
  end

  def feed
    @posts = Current.site.posts.published.recent.limit(20)
    render xml: render_to_string(partial: "site/feed", formats: [:xml]), layout: false
  end

  def sitemap
    head :not_found and return unless Current.site.setting("seo_enable_sitemap", "1") == "1"

    @posts = Current.site.posts.published.order(published_at: :desc)
    @pages = Current.site.pages.where(template_for: nil).published.ordered
    render xml: render_to_string(partial: "site/sitemap", formats: [:xml]), layout: false
  end

  private

  def activate_theme
    preview_theme = params[:preview_theme] if current_user&.admin?
    ThemeManager.activate_for_request!(self, preview_theme || Current.site.active_theme, preview: preview_theme.present?)
  end
end
