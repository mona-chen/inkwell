# frozen_string_literal: true

module Admin
  # Editorial command center. Surfaces what needs attention (drafts, scheduled, pending
  # moderation) plus the freshest content — the working view of a publishing platform,
  # not a generic dashboard.
  class DashboardPage < ApplicationComponent
    def initialize(
      recent_posts:, published_posts:, total_pages:, pending_comments:,
      media_count:, active_plugins:, draft_posts:, scheduled_posts:, total_posts:, recent_comments:
    )
      @recent_posts = recent_posts
      @published_posts = published_posts
      @total_pages = total_pages
      @pending_comments = pending_comments
      @media_count = media_count
      @active_plugins = active_plugins
      @draft_posts = draft_posts
      @scheduled_posts = scheduled_posts
      @total_posts = total_posts
      @recent_comments = recent_comments
    end

    def view_template
      div(class: "space-y-8") do
        render_header
        render_editorial_stats
        render_queue_band
        render_lower_grid
      end
    end

    private

    def render_header
      today = Time.current.strftime("%A, %B %-d, %Y")
      div(class: "flex flex-wrap items-end justify-between gap-4") do
        div do
          h1(class: "text-2xl font-semibold tracking-tight text-foreground") do
            "Good #{greeting}, #{Current.user&.name&.split&.first || "there"}."
          end
          p(class: "mt-1 text-sm text-muted-foreground") { "#{today} · #{Current.site.name}" }
        end
        div(class: "flex items-center gap-2") do
          render Button.new("New post", href: new_admin_post_path, variant: :primary, icon: :plus)
        end
      end
    end

    def greeting
      hour = Time.current.hour
      hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
    end

    def render_editorial_stats
      render StatGrid.new(cols: "2 sm:2 lg:4", gap: 4) do |grid|
        grid.stat(key: :published, label: "Published posts", value: @published_posts, detail: "live")
        grid.stat(key: :drafts, label: "Drafts", value: @draft_posts, detail: "in progress")
        grid.stat(key: :scheduled, label: "Scheduled", value: @scheduled_posts, detail: "queued")
        grid.stat(key: :comments, label: "Pending comments", value: @pending_comments, detail: "need review")
      end
    end

    def render_queue_band
      render Grid.new(cols: "1 lg:3", gap: 6) do
        div(class: "lg:col-span-2") do
          render_queue_card
        end
        div(class: "lg:col-span-1") do
          render_pending_comments_card
        end
      end
    end

    def render_queue_card
      render Card.new do |card|
        card.title { "Your content" }
        card.footer do
          div(class: "flex items-center justify-between") do
            span(class: "text-sm text-muted-foreground") { "#{@total_posts} total · #{@total_pages} pages" }
            a(href: admin_posts_path, class: "text-sm font-medium text-primary hover:underline") { "View all posts" }
          end
        end
        card.body do
          if @recent_posts.empty?
            render EmptyState.new(
              title: "No posts yet",
              description: "Write your first post and start publishing.",
              level: 3,
              variant: :borderless
            )
          else
            ul(class: "divide-y divide-border") do
              @recent_posts.each do |post|
                li(class: "flex items-center gap-4 py-3") do
                  div(class: "min-w-0 flex-1") do
                    a(
                      href: edit_admin_post_path(post),
                      class: "block truncate text-sm font-medium text-foreground hover:text-primary"
                    ) { post.title }
                    div(class: "mt-0.5 flex items-center gap-2 text-xs text-muted-foreground") do
                      span { "by #{post.author&.name}" }
                      span(class: "text-muted-foreground/50") { "·" }
                      span { time_ago(post.updated_at) }
                      if post.categories.any?
                        span(class: "text-muted-foreground/50") { "·" }
                        span { post.categories.map(&:name).join(", ") }
                      end
                    end
                  end
                  render Badge.new(post.status, color: status_color(post.status), size: :sm)
                end
              end
            end
          end
        end
      end
    end

    def render_pending_comments_card
      render Card.new do |card|
        card.title { "Awaiting moderation" }
        card.body do
          if @recent_comments.empty?
            div(class: "py-6 text-center text-sm text-muted-foreground") { "No comments to review." }
          else
            ul(class: "space-y-3") do
              @recent_comments.each do |comment|
                li do
                  a(href: admin_comments_path, class: "block rounded-lg border border-border p-3 transition-colors hover:bg-muted/50") do
                    div(class: "line-clamp-2 text-sm text-foreground") { comment.body }
                    div(class: "mt-1 text-xs text-muted-foreground") { comment.author_name }
                  end
                end
              end
            end
          end
        end
        card.footer do
          a(href: admin_comments_path, class: "text-sm font-medium text-primary hover:underline") { "Review comments" }
        end
      end
    end

    def render_lower_grid
      render Grid.new(cols: "1 lg:3", gap: 6) do
        div(class: "lg:col-span-2") do
          render_quick_actions
        end
        div(class: "lg:col-span-1 space-y-6") do
          render_media_snapshot
          render_plugins_snapshot
        end
      end
    end

    def render_quick_actions
      render Card.new do |card|
        card.title { "Quick actions" }
        card.body do
          Grid(cols: "1 sm:2 lg:4", gap: 3) do
            quick_action("New post", new_admin_post_path, icon: :file_plus, primary: true)
            quick_action("New page", new_admin_page_path, icon: :file_text)
            quick_action("Upload media", admin_media_path, icon: :upload)
            quick_action("Site settings", admin_settings_path, icon: :settings)
          end
        end
      end
    end

    def quick_action(label, path, icon:, primary: false)
      classes = if primary
                  "bg-primary text-primary-foreground hover:bg-primary/90"
                else
                  "bg-muted/50 text-foreground hover:bg-muted"
                end
      a(
        href: path,
        class: "group flex flex-col items-center gap-2 rounded-lg border border-border px-3 py-5 text-sm font-medium transition-all hover:shadow-sm #{classes}"
      ) do
        span(class: "flex h-10 w-10 items-center justify-center rounded-full bg-background/60 text-foreground/80 transition-transform group-hover:scale-110") do
          render Icon.new(icon, size: :md)
        end
        span { label }
      end
    end

    def render_media_snapshot
      render Card.new do |card|
        card.title { "Media library" }
        card.body do
          div(class: "flex items-center gap-4") do
            span(class: "flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground") do
              render Icon.new(:image, size: :md)
            end
            div do
              div(class: "text-2xl font-bold text-foreground") { @media_count }
              div(class: "text-sm text-muted-foreground") { "files uploaded" }
            end
          end
        end
        card.footer do
          a(href: admin_media_path, class: "text-sm font-medium text-primary hover:underline") { "Manage media" }
        end
      end
    end

    def render_plugins_snapshot
      render Card.new do |card|
        card.title { "Plugins" }
        card.body do
          div(class: "flex items-center gap-4") do
            span(class: "flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground") do
              render Icon.new(:puzzle, size: :md)
            end
            div do
              div(class: "text-2xl font-bold text-foreground") { @active_plugins }
              div(class: "text-sm text-muted-foreground") { "active plugins" }
            end
          end
        end
        card.footer do
          a(href: admin_plugins_path, class: "text-sm font-medium text-primary hover:underline") { "Manage plugins" }
        end
      end
    end

    def time_ago(t)
      distance = Time.current - t
      case distance
      when 0...60 then "just now"
      when 60...3600 then "#{(distance / 60).to_i}m ago"
      when 3600...86_400 then "#{(distance / 3600).to_i}h ago"
      else t.strftime("%b %-d")
      end
    end

    def status_color(status)
      case status
      when "published" then :success
      when "scheduled" then :info
      else :neutral
      end
    end
  end
end
