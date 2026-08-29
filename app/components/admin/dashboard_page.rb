# frozen_string_literal: true

module Admin
  # Home screen — shows what needs attention, recent work, and site overview.
  # Designed as a glanceable command center, not a feature showcase.
  class DashboardPage < ApplicationComponent
    def initialize(
      recent_posts:, published_posts:, total_pages:, pending_comments:,
      media_count:, active_plugins:, draft_posts:, scheduled_posts:, total_posts:,
      recent_comments:, spam_comments: 0, total_users: 0, scheduled_queue: [],
      draft_queue: [], storage_bytes: 0
    )
      @recent_posts = recent_posts
      @published_posts = published_posts
      @total_pages = total_pages
      @pending_comments = pending_comments
      @spam_comments = spam_comments
      @media_count = media_count
      @active_plugins = active_plugins
      @draft_posts = draft_posts
      @scheduled_posts = scheduled_posts
      @total_posts = total_posts
      @total_users = total_users
      @recent_comments = recent_comments
      @scheduled_queue = scheduled_queue
      @draft_queue = draft_queue
      @storage_bytes = storage_bytes
    end

    def view_template
      div(class: "admin-dashboard") do
        render_header
        render_stats_strip
        render_recent_content
        render_moderation if @pending_comments.positive?
      end
    end

    private

    # ── Header ──────────────────────────────────────────────────────────
    def render_header
      div(class: "mb-8") do
        h1(class: "text-2xl font-semibold tracking-tight text-foreground") do
          "Good #{greeting}, #{Current.user&.name&.split&.first || "there"}."
        end
        div(class: "mt-1 flex items-center gap-2 text-sm text-muted-foreground") do
          span { Current.site.name }
          if Current.site.domain.present?
            a(href: "https://#{Current.site.domain}", class: "inline-flex items-center gap-0.5 hover:text-foreground transition-colors", target: "_blank") do
              span { Current.site.domain }
              render Icon.new(:external_link, size: :xs)
            end
          end
        end
      end
    end

    def greeting
      hour = Time.current.hour
      hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
    end

    # ── Stats strip ─────────────────────────────────────────────────────
    def render_stats_strip
      div(class: "mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm") do
        stat_item(@published_posts, "Published")
        stat_item(@draft_posts, "Drafts")
        stat_item(@scheduled_posts, "Scheduled")
        if @pending_comments.positive?
          stat_item(@pending_comments, "needs review", highlight: true)
        else
          stat_item(0, "Comments")
        end
      end
    end

    def stat_item(value, label, highlight: false)
      div(class: "flex items-baseline gap-1.5") do
        if value.zero?
          span(class: "text-muted-foreground") { "—" }
        else
          span(class: "font-semibold text-foreground#{highlight ? " text-primary" : ""}") { value.to_s }
        end
        span(class: "text-muted-foreground") { label }
      end
    end

    # ── Recent content ──────────────────────────────────────────────────
    def render_recent_content
      div(class: "mb-8") do
        div(class: "mb-4 flex items-center justify-between") do
          h2(class: "text-sm font-medium text-foreground") { "Recent content" }
          a(href: admin_posts_path, class: "text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1") do
            span { "View all" }
            render Icon.new(:arrow_right, size: :xs)
          end
        end

        if @recent_posts.empty?
          div(class: "rounded-xl border border-border bg-background p-8 text-center") do
            p(class: "text-sm text-muted-foreground") { "No content yet." }
          end
        else
          div(class: "divide-y divide-border rounded-xl border border-border bg-background overflow-hidden") do
            @recent_posts.each { |post| render_post_row(post) }
          end
        end
      end
    end

    def render_post_row(post)
      a(
        href: edit_admin_post_path(post),
        class: "group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30"
      ) do
        div(class: "min-w-0 flex-1") do
          div(class: "truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors") do
            post.title
          end
          div(class: "mt-0.5 flex items-center gap-2 text-xs text-muted-foreground") do
            span { post.author&.name || "—" }
            span(class: "text-muted-foreground/40") { "·" }
            span { relative_time(post.updated_at) }
          end
        end
        render status_badge(post.status)
        div(class: "flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100") do
          render Button.new("Edit", href: edit_admin_post_path(post), variant: :ghost, size: :xs)
          render Button.new("View", href: post_path(post), variant: :ghost, size: :xs, target: "_blank")
        end
      end
    end

    def status_badge(status)
      color = case status
      when "published" then :success
      when "scheduled" then :info
      else :neutral
      end
      Badge.new(status, color: color, size: :xs)
    end

    # ── Inline moderation ───────────────────────────────────────────────
    def render_moderation
      div(class: "rounded-xl border border-border bg-background") do
        div(class: "flex items-center justify-between px-5 py-3.5") do
          h2(class: "text-sm font-medium text-foreground") do
            "Needs your attention"
          end
          span(class: "text-xs text-muted-foreground") { "#{@pending_comments} comment#{@pending_comments == 1 ? '' : 's'}" }
        end
        if @recent_comments.any?
          div(class: "divide-y divide-border") do
            @recent_comments.first(3).each { |comment| render_comment_row(comment) }
          end
        end
        div(class: "px-5 py-3 border-t border-border") do
          a(href: admin_comments_path, class: "text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1") do
            span { "Review all" }
            render Icon.new(:arrow_right, size: :xs)
          end
        end
      end
    end

    def render_comment_row(comment)
      div(class: "px-5 py-4") do
        div(class: "mb-2 text-sm text-foreground leading-relaxed") do
          comment.body.to_s.truncate(120)
        end
        div(class: "flex items-center justify-between") do
          div(class: "text-xs text-muted-foreground") do
            span { comment.author_name || "Anonymous" }
            span(class: "text-muted-foreground/40") { " · " }
            span { relative_time(comment.created_at) }
          end
          div(class: "flex items-center gap-1") do
            render Button.new("Approve", variant: :ghost, size: :xs, icon: :check)
            render Button.new("Reply", variant: :ghost, size: :xs, icon: :reply)
          end
        end
      end
    end

    # ── Helpers ─────────────────────────────────────────────────────────
    def relative_time(t)
      distance = Time.current - t
      case distance
      when 0...60 then "just now"
      when 60...3600 then "#{(distance / 60).to_i}m ago"
      when 3600...86_400 then "#{(distance / 3600).to_i}h ago"
      else t.strftime("%b %-d")
      end
    end
  end
end
