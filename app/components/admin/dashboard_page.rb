# frozen_string_literal: true

module Admin
  # Home screen — shows what needs attention, recent work, and site overview.
  # Designed as a glanceable command center, not a feature showcase.
  class DashboardPage < ApplicationComponent
    def initialize(
      recent_posts:, published_posts:, total_pages:, pending_comments:,
      media_count:, active_plugins:, draft_posts:, scheduled_posts:, total_posts:,
      recent_comments:, spam_comments: 0, total_users: 0, scheduled_queue: [],
      draft_queue: [], storage_bytes: 0, setup_checklist: {}
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
      @setup_checklist = setup_checklist
    end

    def view_template
      div(class: "admin-dashboard") do
        render_header
        render_setup_guide unless setup_complete?
        render_stats_strip
        render_moderation if @pending_comments.positive?
        render_recent_content
      end
    end

    private

    def render_setup_guide
      completed = @setup_checklist.count { |_key, value| value }

      section(class: "mb-8 overflow-hidden rounded-xl border border-border bg-background", aria: { labelledby: "setup-guide-title" }) do
        div(class: "flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between") do
          div do
            h2(id: "setup-guide-title", class: "text-sm font-semibold text-foreground") { "Set up your site" }
            p(class: "mt-1 text-sm text-muted-foreground") { "A short path from a fresh workspace to a published site." }
          end
          div(class: "flex items-center gap-3") do
            span(class: "text-xs tabular-nums text-muted-foreground") { "#{completed} of #{setup_steps.size}" }
            progress(value: completed, max: setup_steps.size, class: "h-1.5 w-24 overflow-hidden rounded-full accent-primary", aria: { label: "Setup progress" })
          end
        end

        ol(class: "divide-y divide-border") do
          setup_steps.each_with_index { |step, index| render_setup_step(step, index) }
        end
      end
    end

    def render_setup_step(step, index)
      complete = @setup_checklist.fetch(step[:key], false)

      li do
        a(
          href: step[:href],
          class: "group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
        ) do
          span(class: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border #{complete ? 'border-success/40 bg-success/10 text-success' : 'border-border text-muted-foreground'}") do
            if complete
              render Icon.new(:check, size: :xs)
            else
              span(class: "text-[11px] font-medium tabular-nums") { index + 1 }
            end
          end
          div(class: "min-w-0 flex-1") do
            div(class: "text-sm font-medium #{complete ? 'text-muted-foreground line-through' : 'text-foreground'}") { step[:title] }
            div(class: "mt-0.5 text-xs text-muted-foreground") { step[:description] }
          end
          span(class: "shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground") do
            render Icon.new(:arrow_right, size: :xs)
          end
        end
      end
    end

    def setup_complete?
      @setup_checklist.present? && @setup_checklist.values.all?
    end

    def setup_steps
      [
        { key: :identity, title: "Name and brand your site", description: "Set the public title, tagline, and identity.", href: admin_settings_path(section: "general") },
        { key: :page, title: "Create your first page", description: "Start with a homepage, about page, or landing page.", href: new_admin_page_path },
        { key: :homepage, title: "Choose the homepage", description: "Decide what visitors see at your root URL.", href: admin_settings_path(section: "homepage") },
        { key: :navigation, title: "Build the navigation", description: "Create a menu and add the first destination.", href: new_admin_menu_path },
        { key: :publication, title: "Publish something", description: "Make a page or post available to visitors.", href: admin_pages_path }
      ]
    end

    # ── Header ──────────────────────────────────────────────────────────
    def render_header
      div(class: "mb-8") do
        h1(class: "text-2xl font-semibold tracking-tight text-foreground") do
          "Good #{greeting}, #{user_first_name}."
        end
        div(class: "mt-1 flex items-center gap-2 text-sm text-muted-foreground") do
          span { Current.site.name }
          if Current.site.domain.present?
            span(class: "text-muted-foreground/40") { "·" }
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

    def user_first_name
      Current.user&.name.to_s.strip.presence || "there"
    end

    # ── Stats strip ─────────────────────────────────────────────────────
    def render_stats_strip
      div(class: "mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm") do
        stat_item(@published_posts, "Published", path: admin_posts_path(status: "published"))
        stat_item(@draft_posts, "Drafts", path: admin_posts_path(status: "draft"))
        stat_item(@scheduled_posts, "Scheduled", path: admin_posts_path(status: "scheduled"))
        if @pending_comments.positive?
          stat_item(@pending_comments, "needs review", highlight: :warning, path: admin_comments_path)
        else
          stat_item(0, "Comments", path: admin_comments_path)
        end
      end
    end

    def stat_item(value, label, highlight: false, path: nil)
      color_class = case highlight
      when :warning then "text-warning"
      when :primary then "text-primary"
      else ""
      end
      value_text = value.zero? ? "0" : value.to_s
      value_class = value.zero? ? "text-muted-foreground" : "font-semibold text-foreground #{color_class}"

      if path
        a(href: path, class: "flex items-baseline gap-1.5 hover:underline transition-colors") do
          span(class: value_class) { value_text }
          span(class: "text-muted-foreground") { label }
        end
      else
        div(class: "flex items-baseline gap-1.5") do
          span(class: value_class) { value_text }
          span(class: "text-muted-foreground") { label }
        end
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
        class: "group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/30"
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
        div(class: "flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity") do
          render Button.new("Edit", href: edit_admin_post_path(post), variant: :ghost, size: :xs)
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
        if comment.post.present?
          div(class: "mb-1.5 text-xs font-medium text-muted-foreground") do
            comment.post.title.to_s.truncate(60)
          end
        end
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
