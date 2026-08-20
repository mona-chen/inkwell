class PostsController < ApplicationController
  before_action :activate_theme

  def show
    @post = Current.site.posts.published.friendly.find(params[:id])
    @head_meta = Inkwell::Hooks.filter(:head_meta, [], post: @post)
  end

  private

  def activate_theme
    ThemeManager.activate_for_request!(self, Current.site.active_theme)
  end
end
