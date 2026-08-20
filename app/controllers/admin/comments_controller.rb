module Admin
  class CommentsController < BaseController
    def index
      @status = params[:status].presence || "pending"
      @comments = Comment.includes(:post, :user).where(status: @status).order(created_at: :desc).page(params[:page])
      render Admin::CommentsPage.new(comments: @comments, status: @status)
    end

    def update
      comment = Comment.find(params[:id])
      comment.update!(status: params[:status])
      Inkwell::Hooks.fire(:comment_moderated, comment)
      redirect_back fallback_location: admin_comments_path, notice: "Comment #{params[:status]}."
    end

    def destroy
      Comment.find(params[:id]).destroy
      redirect_back fallback_location: admin_comments_path, notice: "Comment deleted."
    end
  end
end
