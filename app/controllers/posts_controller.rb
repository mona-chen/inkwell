class PostsController < ApplicationController
  before_action :activate_theme

  def index
    @posts = Current.site.posts.published.includes(:author)
    @category = Current.site.terms.find_by(taxonomy: "category", slug: params[:category]) if params[:category].present?
    @tag = Current.site.terms.find_by(taxonomy: "tag", slug: params[:slug]) if params[:slug].present?
    @posts = @posts.joins(:terms).where(terms: { id: @category.id }) if @category
    @posts = @posts.joins(:terms).where(terms: { id: @tag.id }) if @tag
    @posts = @posts.where("title ILIKE ?", "%#{params[:q]}%") if params[:q].present?
    @posts = @posts.order(published_at: :desc).page(params[:page]).per(9)

    # A page designated as the archive/index template replaces the theme's posts index.
    if (template = Page.template_for(Current.site, "index") || Page.template_for(Current.site, "archive"))
      @page = template
      @template_body = PageBuilder::TemplateRenderer.render(template, view_context: view_context)
      render template: "posts/template_index"
    else
      render template: "posts/index"
    end
  end

  def show
    @post = Current.site.posts.published.friendly.find(params[:id])
    @head_meta = Inkwell::Hooks.filter(:head_meta, [], post: @post)
    @prev_post = Current.site.posts.published.where("published_at < ?", @post.published_at).order(published_at: :desc).first
    @next_post = Current.site.posts.published.where("published_at > ?", @post.published_at).order(published_at: :asc).first
    @related_posts = Current.site.posts.published.where.not(id: @post.id).order(published_at: :desc).limit(3)

    # A page designated as the single-post template replaces the theme's posts/show. `@page`
    # becomes the current post so `{{ page.* }}` bindings resolve; `post:` covers `{{ post.* }}`.
    if (template = Page.template_for(Current.site, "single_post"))
      @page = @post
      @template_body = PageBuilder::TemplateRenderer.render(template, view_context: view_context, locals: { post: @post })
      render template: "posts/template"
    end
  end

  private

  def activate_theme
    ThemeManager.activate_for_request!(self, Current.site.active_theme)
  end
end
