module Admin
  class PostsController < BaseController
    before_action :set_post, only: %i[edit update destroy publish]

    def index
      @posts = policy_scope(Post).includes(:author)
      # Trash is a separate filter: hide trashed posts unless explicitly requested.
      @posts = if %w[draft published scheduled trashed].include?(params[:status])
                 @posts.where(status: params[:status])
      else
                 @posts.where.not(status: "trashed")
      end
      @posts = @posts.where("title ILIKE ?", "%#{params[:q]}%") if params[:q].present?
      @posts = @posts.order(updated_at: :desc).page(params[:page])
      render Admin::PostsPage.new(posts: @posts, status: params[:status], q: params[:q])
    end

    def new
      @post = Current.site.posts.build(author: current_user)
    end

    def create
      @post = Current.site.posts.build(post_params.except(:category_ids, :tag_ids))
      @post.author = current_user
      authorize @post

      if @post.save
        @post.term_ids_by_taxonomy = { "category" => post_params[:category_ids], "tag" => post_params[:tag_ids] }
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
      if @post.update(post_params.except(:category_ids, :tag_ids))
        @post.term_ids_by_taxonomy = { "category" => post_params[:category_ids], "tag" => post_params[:tag_ids] }
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
      # The Publish button submits the main form, so persist the serialized draft from the
      # hidden field before committing it (covers deletes made right before publish).
      @post.update!(draft_content: post_params[:draft_content]) if params.dig(:post, :draft_content).present?
      @post.publish_draft!
      redirect_to edit_admin_post_path(@post), notice: "Published."
    end

    private

    def set_post
      @post = Current.site.posts.friendly.find(params[:id])
    end

    def post_params
      params.require(:post).permit(
        :title, :excerpt, :content, :draft_content, :status, :scheduled_for, :featured_image_alt,
        :seo_title, :seo_description, :seo_focus_keyword, :seo_slug_override,
        :og_title, :og_description, :og_image_url, :twitter_card_type,
        :twitter_title, :twitter_description, :twitter_image_url,
        :canonical_url_override, :breadcrumb_title, :cornerstone,
        :schema_page_type, :schema_article_type,
        :noindex, :nofollow, :robots_noarchive, :robots_noimageindex, :robots_nosnippet,
        category_ids: [], tag_ids: []
      )
    end
  end
end
