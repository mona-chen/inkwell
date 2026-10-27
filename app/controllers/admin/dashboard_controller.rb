module Admin
  class DashboardController < BaseController
    def show
      @recent_posts = Current.site.posts.where.not(status: "trashed").includes(:author).order(updated_at: :desc).limit(5)
      @published_posts = Current.site.posts.published.count
      @total_pages = Current.site.pages.where(template_for: nil).where.not(status: "trashed").count
      @pending_comments = Comment.joins(:post).where(posts: { site_id: Current.site.id }).pending.count
      @spam_comments = Comment.joins(:post).where(posts: { site_id: Current.site.id }, status: "spam").count
      @media_count = Current.site.media_items.count
      @active_plugins = Current.site.plugin_activations.where(active: true).count
      @draft_posts = Current.site.posts.where(status: "draft").count
      @scheduled_posts = Current.site.posts.scheduled.count
      @total_posts = Current.site.posts.where.not(status: "trashed").count
      @total_users = Current.site.users.count
      @recent_comments = Comment.joins(:post).where(posts: { site_id: Current.site.id }).pending.includes(:post).order(created_at: :desc).limit(5)
      @scheduled_queue = Current.site.posts.scheduled.order(:scheduled_for).limit(5)
      @draft_queue = Current.site.posts.where(status: "draft").order(updated_at: :desc).limit(5)
      @storage_bytes = Current.site.media_items.joins(file_attachment: :blob).sum("active_storage_blobs.byte_size")
      recent_pages = Current.site.pages.where(template_for: nil).where.not(status: "trashed").includes(:author).order(updated_at: :desc).limit(5)
      @recent_posts = (@recent_posts.to_a + recent_pages.to_a).sort_by(&:updated_at).reverse.first(8)
      @setup_checklist = Current.site.setup_checklist

      render Admin::DashboardPage.new(
        recent_posts: @recent_posts,
        published_posts: @published_posts,
        total_pages: @total_pages,
        pending_comments: @pending_comments,
        spam_comments: @spam_comments,
        media_count: @media_count,
        active_plugins: @active_plugins,
        draft_posts: @draft_posts,
        scheduled_posts: @scheduled_posts,
        total_posts: @total_posts,
        total_users: @total_users,
        recent_comments: @recent_comments,
        scheduled_queue: @scheduled_queue,
        draft_queue: @draft_queue,
        storage_bytes: @storage_bytes,
        setup_checklist: @setup_checklist
      )
    end
  end
end
