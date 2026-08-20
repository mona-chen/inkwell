module Admin
  class DashboardController < BaseController
    def show
      @recent_posts = Current.site.posts.includes(:author).order(updated_at: :desc).limit(6)
      @published_posts = Current.site.posts.published.count
      @total_pages = Current.site.pages.count
      @pending_comments = Comment.pending.count
      @media_count = Current.site.media_items.count
      @active_plugins = InstalledPlugin.where(active: true).count
      @draft_posts = Current.site.posts.where(status: "draft").count
      @scheduled_posts = Current.site.posts.where(status: "scheduled").count
      @total_posts = Current.site.posts.count
      @recent_comments = Comment.pending.includes(:post).order(created_at: :desc).limit(5)

      render Admin::DashboardPage.new(
        recent_posts: @recent_posts,
        published_posts: @published_posts,
        total_pages: @total_pages,
        pending_comments: @pending_comments,
        media_count: @media_count,
        active_plugins: @active_plugins,
        draft_posts: @draft_posts,
        scheduled_posts: @scheduled_posts,
        total_posts: @total_posts,
        recent_comments: @recent_comments
      )
    end
  end
end
