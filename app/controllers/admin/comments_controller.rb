module Admin
  class CommentsController < BaseController
    def index
      @status = params[:status].presence || "pending"
      @comments = site_comments.where(status: @status).order(created_at: :desc).page(params[:page])
      render Admin::CommentsPage.new(comments: @comments, status: @status)
    end

    def update
      comment = site_comments.find(params[:id])
      comment.update!(status: params[:status])
      Inkwell::Hooks.fire(:comment_moderated, comment)
      redirect_back fallback_location: admin_comments_path, notice: "Comment #{params[:status]}."
    end

    def destroy
      comment = site_comments.find(params[:id])
      if comment.status == "trashed"
        comment.destroy
        notice = "Comment permanently deleted."
      else
        comment.update!(status: "trashed")
        notice = "Comment moved to trash."
      end
      redirect_back fallback_location: admin_comments_path, notice: notice
    end

    private

    def site_comments
      Comment.includes(:post, :user).joins(:post).where(posts: { site_id: Current.site.id })
    end
  end
end
