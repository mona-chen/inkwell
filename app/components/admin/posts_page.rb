# frozen_string_literal: true

module Admin
  class PostsPage < ApplicationComponent
    STATUSES = [["All", nil], ["Published", "published"], ["Draft", "draft"], ["Scheduled", "scheduled"]].freeze

    def initialize(posts:, status: nil, q: nil, pagy: nil)
      @posts = posts
      @status = status
      @q = q
      @pagy = pagy
    end

    def view_template
      div(class: "max-w-[1100px]") do
        render_header
        render_filters
        if @posts.empty?
          render_empty
        else
          render_post_list
        end
      end
    end

    private

    def render_header
      div(class: "mb-6 flex items-center justify-between") do
        div do
          h1(class: "text-2xl font-bold tracking-tight") { "Posts" }
          p(class: "mt-1 text-sm text-muted-foreground") { "#{pluralize(@posts.total_count, "post")} · your publishing queue" }
        end
        render Button.new("New post", href: new_admin_post_path, variant: :primary, icon: :plus)
      end
    end

    def render_filters
      div(class: "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between") do
        div(class: "flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/50 p-1") do
          STATUSES.each do |(label, value)|
            current = @status == value || (value.nil? && @status.nil?)
            a(
              href: admin_posts_path(status: value, q: @q),
              class: "rounded-md px-3 py-1.5 text-sm font-medium transition-all #{current ? "bg-card text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground hover:bg-card/50"}"
            ) { label }
          end
        end

        form_with(url: admin_posts_path, method: :get, class: "sm:w-72") do |f|
          div(class: "relative") do
            span(class: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground") do
              render Icon.new(:search, size: :sm)
            end
            f.search_field :q,
              value: @q,
              placeholder: "Search posts…",
              class: "w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          end
        end
      end
    end

    def render_post_list
      div(class: "overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border/60") do
        @posts.each { |post| render_post_row(post) }
      end
      render Pagination.new(pagy: @pagy) if @pagy
    end

    def render_post_row(post)
      a(
        href: edit_admin_post_path(post),
        class: "group flex items-center gap-4 border-b border-border/60 px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/40"
      ) do
        div(class: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors") do
          render Icon.new(:file_text, size: :sm)
        end
        div(class: "min-w-0 flex-1") do
          div(class: "truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors") { post.title }
          div(class: "mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground") do
            span { "by #{post.author&.name || "unknown"}" }
            span(class: "opacity-30") { "·" }
            span { relative_time(post.updated_at) }
            if post.categories.any?
              span(class: "opacity-30") { "·" }
              span { post.categories.map(&:name).join(", ") }
            end
          end
        end
        render status_badge(post.status)
        span(class: "shrink-0 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground") do
          render Icon.new(:chevron_right, size: :sm)
        end
      end
    end

    def render_empty
      render EmptyState.new(
        title: @q.present? ? "No results for \"#{@q}\"" : (empty_status_title || "No posts yet"),
        description: @q.present? ? "Try a different search or clear the filters." : "Write your first post and publish it to the world.",
        level: 3
      ) do |state|
        unless @q.present?
          state.action(Button.new("Write your first post", href: new_admin_post_path, icon: :plus))
        end
      end
    end

    def empty_status_title
      case @status
      when "published" then "No published posts"
      when "draft" then "No drafts"
      when "scheduled" then "Nothing scheduled"
      when "trashed" then "Trash is empty"
      end
    end

    def relative_time(t)
      distance = Time.current - t
      case distance
      when 0...60 then "just now"
      when 60...3600 then "#{(distance / 60).to_i}m ago"
      when 3600...86_400 then "#{(distance / 3600).to_i}h ago"
      when 86_400...(7 * 86_400) then "#{(distance / 86_400).to_i}d ago"
      else t.strftime("%b %-d, %Y")
      end
    end

    def status_color(status)
      case status
      when "published" then :success
      when "scheduled" then :info
      when "trashed" then :neutral
      else :warning
      end
    end

    def status_badge(status)
      Badge.new(status, color: status_color(status), size: :xs)
    end
  end
end
