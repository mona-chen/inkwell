module Admin
  class DashboardController < BaseController
    def show
      @recent_posts = Current.site.posts.where.not(status: "trashed").includes(:author).order(updated_at: :desc).limit(5)
      @published_posts = Current.site.posts.published.count
      @total_pages = Current.site.pages.count
      @pending_comments = Comment.pending.count
      @spam_comments = Comment.where(status: "spam").count
      @media_count = Current.site.media_items.count
      @active_plugins = InstalledPlugin.where(active: true).count
      @draft_posts = Current.site.posts.where(status: "draft").count
      @scheduled_posts = Current.site.posts.scheduled.count
      @total_posts = Current.site.posts.count
      @total_users = Current.site.users.count
      @recent_comments = Comment.pending.includes(:post).order(created_at: :desc).limit(5)
      @scheduled_queue = Current.site.posts.scheduled.order(:scheduled_for).limit(5)
      @draft_queue = Current.site.posts.where(status: "draft").order(updated_at: :desc).limit(5)
      @storage_bytes = Current.site.media_items.sum { |m| m.file.blob.byte_size rescue 0 }

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
        storage_bytes: @storage_bytes
      )
    end
  end
end
