module Admin
  class PostRevisionsController < BaseController
    def index
      @post = Current.site.posts.friendly.find(params[:post_id])
      @revisions = @post.revisions.order(created_at: :desc)
      render Admin::PostRevisionsPage.new(post: @post, revisions: @revisions)
    end

    def show
      @post = Current.site.posts.friendly.find(params[:post_id])
      @revision = @post.revisions.find(params[:id])
      render Admin::PostRevisionPage.new(post: @post, revision: @revision)
    end

    def restore
      @post = Current.site.posts.friendly.find(params[:post_id])
      revision = @post.revisions.find(params[:id])
      @post.restore_revision!(revision)
      redirect_to edit_admin_post_path(@post), notice: "Restored the version from #{revision.created_at.strftime('%b %-d, %Y at %l:%M%P')}."
    end
  end
end
