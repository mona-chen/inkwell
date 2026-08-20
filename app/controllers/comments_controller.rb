class CommentsController < ApplicationController
  before_action :activate_theme

  def create
    post = Current.site.posts.published.friendly.find(params[:post_id])
    comment = post.comments.new(comment_params)
    comment.status = "pending"
    comment.user = current_user if current_user

    if comment.save
      redirect_to post_path(post), notice: "Thanks — your comment is pending moderation."
    else
      redirect_back fallback_location: post_path(post), alert: comment.errors.full_messages.to_sentence
    end
  end

  private

  def comment_params
    params.require(:comment).permit(:body, :guest_name, :guest_email)
  end

  def activate_theme
    ThemeManager.activate_for_request!(self, Current.site.active_theme)
  end
end
