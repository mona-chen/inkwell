# frozen_string_literal: true

module Admin
  # The publishing command center. It prioritizes work that can be resumed or
  # needs attention, then gives a compact inventory of the site.
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
      main(class: "mx-auto flex w-full max-w-[92rem] flex-col gap-6", aria: { labelledby: "dashboard-title" }) do
        render_hero
        render_setup_guide unless setup_complete?
        render_metrics
        div(class: "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]") do
          render_recent_content
          aside(class: "flex min-w-0 flex-col gap-6", aria: { label: "Publishing overview" }) do
            render_focus_card
            render_site_snapshot
          end
        end
      end
    end

    private

    def render_hero
      section(class: "relative isolate overflow-hidden rounded-2xl border border-white/8 bg-sidebar px-6 py-7 text-sidebar-foreground shadow-[0_24px_70px_-42px_rgba(15,23,42,0.8)] sm:px-8 sm:py-9 lg:px-10") do
        div(class: "pointer-events-none absolute -right-16 -top-28 -z-10 h-72 w-72 rounded-full bg-primary/25 blur-3xl")
        div(class: "pointer-events-none absolute -bottom-32 right-1/3 -z-10 h-64 w-64 rounded-full bg-white/5 blur-3xl")

        div(class: "flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between") do
          div(class: "max-w-3xl") do
            div(class: "mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55") do
              span(class: "h-2 w-2 rounded-full bg-success ring-4 ring-success/10")
              span { Current.site.name }
              span(class: "text-sidebar-foreground/20") { "/" }
              time(datetime: Date.current.iso8601) { Time.current.strftime("%A, %B %-d") }
            end
            h1(id: "dashboard-title", class: "max-w-2xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl") do
              "Good #{greeting}, #{user_first_name}."
            end
            p(class: "mt-3 max-w-2xl text-sm leading-6 text-sidebar-foreground/60 sm:text-base") do
              hero_message
            end
          end

          div(class: "flex flex-wrap gap-3") do
            a(
              href: new_admin_post_path,
              class: "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            ) do
              render_icon(:pen_line, :sm)
              span { "Write a post" }
            end
            a(
              href: new_admin_page_path,
              class: "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            ) do
              render_icon(:layout_template, :sm)
              span { "Build a page" }
            end
          end
        end
      end
    end

    def hero_message
      if @pending_comments.positive?
        "You have #{pluralize(@pending_comments, 'comment')} waiting for review. Your latest work is ready below."
      elsif @draft_posts.positive?
        "Pick up one of your #{pluralize(@draft_posts, 'draft')} or start something new for your audience."
      else
        "Your publishing workspace is clear. Start something new or review what is already live."
      end
    end

    def render_setup_guide
      completed = @setup_checklist.count { |_key, value| value }
      progress = (completed.to_f / setup_steps.size * 100).round

      section(class: "overflow-hidden rounded-2xl border border-border bg-card shadow-sm", aria: { labelledby: "setup-title" }) do
        div(class: "flex flex-col gap-5 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6") do
          div(class: "flex items-start gap-3") do
            span(class: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary") { render_icon(:sparkles, :md) }
            div do
              h2(id: "setup-title", class: "text-base font-semibold tracking-tight") { "Launch your site" }
              p(class: "mt-0.5 text-sm text-muted-foreground") { "Complete the essentials, then make Inkwell your own." }
            end
          end
          div(class: "min-w-44") do
            div(class: "mb-2 flex items-center justify-between text-xs font-medium") do
              span(class: "text-muted-foreground") { "#{completed} of #{setup_steps.size} complete" }
              span(class: "tabular-nums text-foreground") { "#{progress}%" }
            end
            div(class: "h-2 overflow-hidden rounded-full bg-muted", role: "progressbar", aria: { label: "Site setup progress", valuenow: completed, valuemin: 0, valuemax: setup_steps.size }) do
              div(class: "h-full rounded-full bg-primary transition-[width]", style: "width: #{progress}%")
            end
          end
        end

        ol(class: "grid divide-y divide-border md:grid-cols-5 md:divide-x md:divide-y-0") do
          setup_steps.each_with_index { |step, index| render_setup_step(step, index) }
        end
      end
    end

    def render_setup_step(step, index)
      complete = @setup_checklist.fetch(step[:key], false)
      li(class: "min-w-0") do
        a(href: step[:href], class: "group flex h-full items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/55") do
          span(class: "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold #{complete ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}") do
            complete ? render_icon(:check, :xs) : plain((index + 1).to_s)
          end
          div(class: "min-w-0") do
            div(class: "text-sm font-medium leading-5 #{complete ? 'text-muted-foreground line-through' : 'text-foreground'}") { step[:title] }
            div(class: "mt-0.5 hidden text-xs leading-5 text-muted-foreground xl:block") { step[:description] }
          end
        end
      end
    end

    def setup_complete?
      @setup_checklist.present? && @setup_checklist.values.all?
    end

    def setup_steps
      [
        { key: :identity, title: "Brand", description: "Name and identify your site.", href: admin_settings_path(section: "general") },
        { key: :page, title: "First page", description: "Create a place to begin.", href: new_admin_page_path },
        { key: :homepage, title: "Homepage", description: "Choose the front door.", href: admin_settings_path(section: "homepage") },
        { key: :navigation, title: "Navigation", description: "Help visitors get around.", href: new_admin_menu_path },
        { key: :publication, title: "Go live", description: "Publish your first work.", href: admin_pages_path }
      ]
    end

    def render_metrics
      section(class: "grid grid-cols-2 gap-3 lg:grid-cols-4", aria: { label: "Content overview" }) do
        render_metric(icon: :radio, label: "Published", value: @published_posts, detail: "#{pluralize(@total_posts, 'post')} total", href: admin_posts_path(status: "published"), tone: :success)
        render_metric(icon: :file_pen_line, label: "In progress", value: @draft_posts, detail: @scheduled_posts.positive? ? "#{pluralize(@scheduled_posts, 'post')} scheduled" : "No posts scheduled", href: admin_posts_path(status: "draft"), tone: :primary)
        render_metric(icon: :panels_top_left, label: "Pages", value: @total_pages, detail: "Site structure", href: admin_pages_path, tone: :info)
        render_metric(icon: :messages_square, label: "Needs review", value: @pending_comments, detail: @spam_comments.positive? ? "#{pluralize(@spam_comments, 'spam item')} filtered" : "Comments are up to date", href: admin_comments_path, tone: @pending_comments.positive? ? :warning : :neutral)
      end
    end

    def render_metric(icon:, label:, value:, detail:, href:, tone:)
      tone_classes = {
        success: "bg-success/10 text-success",
        primary: "bg-primary/10 text-primary",
        info: "bg-info/10 text-info",
        warning: "bg-warning/12 text-warning",
        neutral: "bg-muted text-muted-foreground"
      }

      a(href: href, class: "group min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:p-5") do
        div(class: "flex items-start justify-between gap-3") do
          span(class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl #{tone_classes.fetch(tone)}") { render_icon(icon, :sm) }
          span(class: "text-muted-foreground/35 transition group-hover:text-primary") { render_icon(:arrow_up_right, :xs) }
        end
        div(class: "mt-5 flex items-end justify-between gap-3") do
          div(class: "min-w-0") do
            p(class: "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground") { label }
            p(class: "mt-1 truncate text-xs text-muted-foreground") { detail }
          end
          strong(class: "text-4xl font-semibold leading-none tracking-[-0.04em] tabular-nums") { value.to_s }
        end
      end
    end

    def render_recent_content
      section(class: "min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm", aria: { labelledby: "recent-content-title" }) do
        div(class: "flex items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-6") do
          div do
            h2(id: "recent-content-title", class: "text-base font-semibold tracking-tight") { "Recent work" }
            p(class: "mt-0.5 text-sm text-muted-foreground") { "Return to the content your team touched most recently." }
          end
          a(href: admin_posts_path, class: "inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80") do
            span { "All posts" }
            render_icon(:arrow_right, :xs)
          end
        end

        if @recent_posts.empty?
          render_empty_recent
        else
          div do
            @recent_posts.each { |post| render_post_row(post) }
          end
        end
      end
    end

    def render_empty_recent
      div(class: "flex flex-col items-center px-6 py-16 text-center") do
        span(class: "flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground") { render_icon(:file_plus_2, :lg) }
        h3(class: "mt-4 text-sm font-semibold") { "Your first story starts here" }
        p(class: "mt-1 max-w-sm text-sm text-muted-foreground") { "Create a draft and it will stay within reach on this dashboard." }
        div(class: "mt-4") { render Button.new("Write a post", href: new_admin_post_path, variant: :primary, size: :sm, icon: :plus) }
      end
    end

    def render_post_row(post)
      a(href: edit_admin_post_path(post), class: "group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/45 sm:gap-4 sm:px-6") do
        span(class: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition group-hover:border-primary/25 group-hover:text-primary") do
          render_icon(:file_text, :sm)
        end
        div(class: "min-w-0") do
          div(class: "truncate text-sm font-semibold text-foreground transition group-hover:text-primary") { post.title.presence || "Untitled post" }
          div(class: "mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground") do
            span(class: "truncate") { post.author&.name || "No author" }
            span(class: "text-border") { "•" }
            span(class: "shrink-0") { relative_time(post.updated_at) }
          end
        end
        div(class: "flex items-center gap-2") do
          render status_badge(post.status)
          span(class: "hidden text-muted-foreground/45 transition group-hover:translate-x-0.5 group-hover:text-primary sm:block") { render_icon(:chevron_right, :sm) }
        end
      end
    end

    def render_focus_card
      section(class: "overflow-hidden rounded-2xl border border-border bg-card shadow-sm", aria: { labelledby: "focus-title" }) do
        div(class: "border-b border-border px-5 py-5") do
          h2(id: "focus-title", class: "text-base font-semibold tracking-tight") { "Publishing focus" }
          p(class: "mt-0.5 text-sm text-muted-foreground") { "What is next in the workflow." }
        end

        div(class: "divide-y divide-border") do
          render_focus_item(icon: :messages_square, label: @pending_comments.positive? ? "Review comments" : "Comments reviewed", detail: @pending_comments.positive? ? pluralize(@pending_comments, "waiting response") : "Nothing needs attention", href: admin_comments_path, tone: @pending_comments.positive? ? :warning : :success)
          render_focus_item(icon: :calendar_clock, label: "Scheduled", detail: next_scheduled_detail, href: admin_posts_path(status: "scheduled"), tone: :info)
          render_focus_item(icon: :file_pen_line, label: "Drafts", detail: draft_detail, href: admin_posts_path(status: "draft"), tone: :primary)
        end
      end
    end

    def render_focus_item(icon:, label:, detail:, href:, tone:)
      tone_class = {
        warning: "bg-warning/12 text-warning",
        success: "bg-success/10 text-success",
        info: "bg-info/10 text-info",
        primary: "bg-primary/10 text-primary"
      }.fetch(tone)

      a(href: href, class: "group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/45") do
        span(class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl #{tone_class}") { render_icon(icon, :sm) }
        div(class: "min-w-0 flex-1") do
          div(class: "text-sm font-semibold") { label }
          div(class: "mt-0.5 truncate text-xs text-muted-foreground") { detail }
        end
        span(class: "text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary") { render_icon(:chevron_right, :sm) }
      end
    end

    def next_scheduled_detail
      post = @scheduled_queue.first
      return "No posts in the queue" unless post
      return post.title.to_s.truncate(42) unless post.respond_to?(:scheduled_for) && post.scheduled_for

      "#{post.title.to_s.truncate(28)} · #{post.scheduled_for.strftime('%b %-d')}"
    end

    def draft_detail
      post = @draft_queue.first
      return "No drafts in progress" unless post
      "#{post.title.presence || 'Untitled post'} · #{relative_time(post.updated_at)}"
    end

    def render_site_snapshot
      section(class: "rounded-2xl border border-border bg-card p-5 shadow-sm", aria: { labelledby: "snapshot-title" }) do
        div(class: "flex items-center justify-between gap-3") do
          h2(id: "snapshot-title", class: "text-base font-semibold tracking-tight") { "Site snapshot" }
          a(href: "/", target: "_blank", aria: { label: "Open public site" }, class: "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary") { render_icon(:external_link, :sm) }
        end
        dl(class: "mt-5 grid grid-cols-2 gap-x-5 gap-y-4") do
          snapshot_item("Media", @media_count)
          snapshot_item("Team", @total_users)
          snapshot_item("Extensions", @active_plugins)
          snapshot_item("Storage", formatted_storage)
        end
        if Current.site.domain.present?
          div(class: "mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground") do
            span(class: "h-1.5 w-1.5 rounded-full bg-success")
            span(class: "min-w-0 truncate") { Current.site.domain }
          end
        end
      end
    end

    def snapshot_item(label, value)
      div do
        dt(class: "text-xs text-muted-foreground") { label }
        dd(class: "mt-1 text-sm font-semibold tabular-nums") { value.to_s }
      end
    end

    def formatted_storage
      bytes = @storage_bytes.to_i
      return "0 MB" if bytes.zero?
      return "#{(bytes / 1.megabyte.to_f).round(1)} MB" if bytes < 1.gigabyte

      "#{(bytes / 1.gigabyte.to_f).round(1)} GB"
    end

    def status_badge(status)
      color = case status
      when "published" then :success
      when "scheduled" then :info
      else :neutral
      end
      Badge.new(status.to_s.capitalize, color: color, size: :xs)
    end

    def greeting
      hour = Time.current.hour
      hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
    end

    def user_first_name
      Current.user&.name.to_s.strip.split.first.presence || "there"
    end

    def relative_time(time)
      distance = Time.current - time
      case distance
      when 0...60 then "just now"
      when 60...3600 then "#{(distance / 60).to_i}m ago"
      when 3600...86_400 then "#{(distance / 3600).to_i}h ago"
      when 86_400...604_800 then "#{(distance / 86_400).to_i}d ago"
      else time.strftime("%b %-d")
      end
    end

    def render_icon(name, size)
      render Icon.new(name, size: size)
    end
  end
end
