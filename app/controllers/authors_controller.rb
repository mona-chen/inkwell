class AuthorsController < ApplicationController
  before_action :activate_theme

  def show
    @author = Current.site.users.find { |u| u.to_param == params[:slug] }
    raise ActiveRecord::RecordNotFound unless @author

    @posts = @author.posts.published.order(published_at: :desc).page(params[:page]).per(9)
    render template: "authors/show"
  end

  private

  def activate_theme
    ThemeManager.activate_for_request!(self, Current.site.active_theme)
  end
end
