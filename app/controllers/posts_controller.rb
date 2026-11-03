class PostsController < ApplicationController
  before_action :activate_theme

  def index
    return if params.values_at(:category, :slug).none?(&:present?) && render_theme_blog("blog_index")

    @posts = Current.site.posts.published.includes(:author)
    @category = Current.site.terms.find_by(taxonomy: "category", slug: params[:category]) if params[:category].present?
    @tag = Current.site.terms.find_by(taxonomy: "tag", slug: params[:slug]) if params[:slug].present?
    @posts = @posts.joins(:terms).where(terms: { id: @category.id }) if @category
    @posts = @posts.joins(:terms).where(terms: { id: @tag.id }) if @tag
    @posts = @posts.where("title ILIKE ?", "%#{params[:q]}%") if params[:q].present?
    @posts = @posts.order(published_at: :desc).page(params[:page]).per(9)

    # A page designated as the archive/index template replaces the theme's posts index.
    roles = params.values_at(:category, :slug, :q).any?(&:present?) ? %w[archive index] : %w[index archive]
    if !preview_theme_defaults? && (template = roles.lazy.map { |role| Page.template_for(Current.site, role) }.find(&:present?))
      @page = template
      @template_body = PageBuilder::TemplateRenderer.render(template, view_context: view_context)
      render template: "posts/template_index"
    else
      render template: "posts/index"
    end
  end

  def show
    @post = Current.site.posts.published.friendly.find(params[:id])
    return if render_theme_blog("blog_post", slug: @post.slug)

    @head_meta = Inkwell::Hooks.filter(:head_meta, [], post: @post)
    @prev_post = Current.site.posts.published.where("published_at < ?", @post.published_at).order(published_at: :desc).first
    @next_post = Current.site.posts.published.where("published_at > ?", @post.published_at).order(published_at: :asc).first
    @related_posts = Current.site.posts.published.where.not(id: @post.id).order(published_at: :desc).limit(3)

    # A page designated as the single-post template replaces the theme's posts/show. `@page`
    # becomes the current post so `{{ page.* }}` bindings resolve; `post:` covers `{{ post.* }}`.
    if !preview_theme_defaults? && (template = Page.template_for(Current.site, "single_post"))
      @page = @post
      @template_body = PageBuilder::TemplateRenderer.render(template, view_context: view_context, locals: { post: @post })
      render template: "posts/template"
    end
  end

  private

  def render_theme_blog(role, slug: nil)
    runtime = ThemePackages::Runtime.for(@current_theme)
    return false unless runtime&.manifest&.kind == "static"

    path = runtime.manifest.templates[role]
    return false unless runtime.manifest.routes.key?(path)
    return false if path.include?(":") && !(slug && path.end_with?("/:slug"))

    runtime.render(self, slug ? path.sub(/:slug\z/, slug) : path, fallback: false)
  end

  def activate_theme
    preview_theme = params[:preview_theme] if current_user&.admin?
    ThemeManager.activate_for_request!(self, preview_theme || Current.site.active_theme, preview: preview_theme.present?)
  end
end
