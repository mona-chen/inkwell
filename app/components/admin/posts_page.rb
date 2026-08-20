# frozen_string_literal: true

module Admin
  # Posts index: a content-first list — search, status filter tabs, then rich rows
  # (title, author/date/categories, status badge, actions) instead of a cramped table.
  # Rendered from Admin::PostsController#index.
  class PostsPage < ApplicationComponent
    STATUSES = [["All", nil], ["Published", "published"], ["Draft", "draft"], ["Scheduled", "scheduled"]].freeze

    def initialize(posts:, status: nil, q: nil, pagy: nil)
      @posts = posts
      @status = status
      @q = q
      @pagy = pagy
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Posts",
            subtitle: "#{pluralize(@posts.total_count, "post")} · your publishing queue"
          )
        end
        toolbar.trailing do
          render Button.new("New post", href: new_admin_post_path, variant: :primary, icon: :plus)
        end
      end

      render_filters

      if @posts.empty?
        render_empty
      else
        render_post_list
      end
    end

    private

    def render_filters
      div(class: "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between") do
        # Status tabs
        div(class: "flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1") do
          STATUSES.each do |(label, value)|
            current = @status == value || (value.nil? && @status.nil?)
            a(
              href: admin_posts_path(status: value, q: @q),
              class: "rounded-md px-3 py-1.5 text-sm font-medium transition-colors #{current ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}"
            ) { label }
          end
        end

        # Search form
        form_with(url: admin_posts_path, method: :get, class: "sm:w-64") do |f|
          div(class: "relative") do
            span(class: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground") do
              render Icon.new(:search, size: :sm)
            end
            f.search_field :q,
              value: @q,
              placeholder: "Search posts…",
              class: "w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          end
        end
      end
    end

    def render_post_list
      div(class: "overflow-hidden rounded-xl border border-border bg-background") do
        ul(class: "divide-y divide-border") do
          @posts.each { |post| render_post_row(post) }
        end
      end
      render Pagination.new(pagy: @pagy) if @pagy
    end

    def render_post_row(post)
      li(class: "group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40") do
        div(class: "min-w-0 flex-1") do
          div(class: "flex items-center gap-2") do
            a(
              href: edit_admin_post_path(post),
              class: "truncate text-[15px] font-semibold text-foreground transition-colors group-hover:text-primary"
            ) { post.title }
            render Badge.new(post.status, color: status_color(post.status), size: :xs)
          end
          div(class: "mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground") do
            span { "by #{post.author&.name || "unknown"}" }
            span(class: "text-muted-foreground/40") { "·" }
            span { relative_time(post.updated_at) }
            if post.categories.any?
              span(class: "text-muted-foreground/40") { "·" }
              span { post.categories.map(&:name).join(", ") }
            end
          end
        end

        div(class: "flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100") do
          render Button.new("Edit", href: edit_admin_post_path(post), variant: :ghost, size: :sm)
          render Button.new("View", href: post_path(post), variant: :ghost, size: :sm, target: "_blank")
          render ButtonTo.new(
            "Trash",
            href: admin_post_path(post),
            method: :delete,
            variant: :ghost,
            size: :sm,
            button_aria: { label: "Trash #{post.title}" },
            data: { turbo_confirm: "Move this post to trash?" }
          )
        end
      end
    end

    def render_empty
      render EmptyState.new(
        title: @q.present? ? "No results for “#{@q}”" : (empty_status_title || "No posts yet"),
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
  end
end
