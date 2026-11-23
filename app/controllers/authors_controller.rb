class AuthorsController < ApplicationController
  before_action :activate_theme

  def show
    @author = Current.site.users.find { |u| u.to_param == params[:slug] }
    raise ActiveRecord::RecordNotFound unless @author
    return if render_theme_author

    @posts = @author.posts.published.order(published_at: :desc).page(params[:page]).per(9)
    if !preview_theme_defaults? && (template = Page.template_for(Current.site, "single_author"))
      @page = template
      @template_body = PageBuilder::TemplateRenderer.render(template, view_context: view_context, locals: { author: @author })
      render template: "authors/template"
    else
      render template: "authors/show"
    end
  end

  private

  # Static themes that declare an author template (e.g. /contributors/:slug) render it.
  def render_theme_author
    runtime = ThemePackages::Runtime.for(@current_theme)
    return false unless runtime&.manifest&.kind == "static"

    path = runtime.manifest.templates["author"].to_s
    return false unless path.end_with?("/:slug") && runtime.manifest.routes.key?(path)

    runtime.render(self, path.sub(/:slug\z/, @author.to_param), fallback: false)
  end

  def activate_theme
    preview_theme = params[:preview_theme] if current_user&.admin?
    ThemeManager.activate_for_request!(self, preview_theme || Current.site.active_theme, preview: preview_theme.present?)
  end
end
