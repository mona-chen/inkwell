module Admin
  class PostsController < BaseController
    before_action :set_post, only: %i[edit update destroy]

    def index
      @posts = policy_scope(Post).includes(:author)
      @posts = @posts.where(status: params[:status]) if params[:status].present? && %w[draft published scheduled trashed].include?(params[:status])
      @posts = @posts.where("title ILIKE ?", "%#{params[:q]}%") if params[:q].present?
      @posts = @posts.order(updated_at: :desc).page(params[:page])
      render Admin::PostsPage.new(posts: @posts, status: params[:status], q: params[:q])
    end

    def new
      @post = Current.site.posts.build(author: current_user)
    end

    def create
      @post = Current.site.posts.build(post_params.except(:category_ids))
      @post.author = current_user
      authorize @post

      if @post.save
        @post.term_ids_by_taxonomy = { "category" => post_params[:category_ids] } if post_params[:category_ids]
        redirect_to edit_admin_post_path(@post), notice: "Post created."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def edit
      authorize @post
    end

    def update
      authorize @post
      if @post.update(post_params.except(:category_ids))
        @post.term_ids_by_taxonomy = { "category" => post_params[:category_ids] } if post_params[:category_ids]
        Inkwell::Hooks.fire(:post_updated, @post)
        respond_to do |format|
          format.turbo_stream { head :ok }
          format.json { render json: { ok: true, updated_at: @post.updated_at } }
          format.html { redirect_to edit_admin_post_path(@post), notice: "Saved." }
        end
      else
        respond_to do |format|
          format.turbo_stream { head :unprocessable_entity }
          format.json { render json: { errors: @post.errors.full_messages }, status: :unprocessable_entity }
          format.html { render :edit, status: :unprocessable_entity }
        end
      end
    end

    def destroy
      authorize @post
      @post.update!(status: "trashed")
      redirect_to admin_posts_path, notice: "Moved to trash."
    end

    # Explicit publish: commit the in-progress draft to live content + mark published.
    def publish
      authorize @post
      @post.publish_draft!
      redirect_to edit_admin_post_path(@post), notice: "Published."
    end

    private

    def set_post
      @post = Current.site.posts.friendly.find(params[:id])
    end

    def post_params
      params.require(:post).permit(:title, :excerpt, :content, :draft_content, :status, :featured_image_alt, category_ids: [])
    end
  end
end
