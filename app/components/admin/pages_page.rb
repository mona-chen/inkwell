# frozen_string_literal: true

module Admin
  # Pages index: a content-first list matching the posts index — search, status tabs,
  # and rich rows. Rendered from Admin::PagesController#index.
  class PagesPage < ApplicationComponent
    STATUSES = [["All", nil], ["Published", "published"], ["Draft", "draft"]].freeze

    def initialize(pages:, status: nil, q: nil, pagy: nil)
      @pages = pages
      @status = status
      @q = q
      @pagy = pagy
    end

    def view_template
      div(class: "admin-pages") do
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Pages",
            subtitle: "#{pluralize(@pages.total_count, "page")} · timeless content"
          )
        end
        toolbar.trailing do
          render Button.new("New page", href: new_admin_page_path, variant: :primary, icon: :plus)
        end
      end

      render_filters

        if @pages.empty?
          render_empty
        else
          render_page_list
        end
      end
    end

    private

    def render_filters
      div(class: "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between") do
        div(class: "flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1") do
          STATUSES.each do |(label, value)|
            current = @status == value || (value.nil? && @status.nil?)
            a(
              href: admin_pages_path(status: value, q: @q),
              class: "rounded-md px-3 py-1.5 text-sm font-medium transition-colors #{current ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}"
            ) { label }
          end
        end

        form_with(url: admin_pages_path, method: :get, class: "sm:w-64") do |f|
          div(class: "relative") do
            span(class: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground") do
              render Icon.new(:search, size: :sm)
            end
            f.search_field :q,
              value: @q,
              placeholder: "Search pages…",
              class: "w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          end
        end
      end
    end

    def render_page_list
      div(class: "overflow-hidden rounded-xl border border-border bg-background") do
        ul(class: "divide-y divide-border") do
          @pages.each { |page| render_page_row(page) }
        end
      end
      render Pagination.new(pagy: @pagy) if @pagy
    end

    def render_page_row(page)
      li(class: "group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40") do
        div(class: "min-w-0 flex-1") do
          div(class: "flex items-center gap-2") do
            a(
              href: edit_admin_page_path(page),
              class: "truncate text-[15px] font-semibold text-foreground transition-colors group-hover:text-primary"
            ) { page.title }
            render Badge.new(page.status, color: page.status == "published" ? :success : :neutral, size: :xs)
            if page.live_render_mode == "original_import"
              render Badge.new("original live", color: :info, size: :xs)
            elsif page.status == "published"
              render Badge.new("native live", color: :neutral, size: :xs)
            end
          end
          div(class: "mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground") do
            span { "by #{page.author&.name || "unknown"}" }
            span(class: "text-muted-foreground/40") { "·" }
            span { relative_time(page.updated_at) }
            span(class: "text-muted-foreground/40") { "·" }
            span { page.template }
          end
        end

        div(class: "flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100") do
          render Button.new("Edit", href: edit_admin_page_path(page), variant: :ghost, size: :sm)
          render Button.new("View", href: page_path(page), variant: :ghost, size: :sm, target: "_blank")
          render ButtonTo.new(
            "Delete",
            href: admin_page_path(page),
            method: :delete,
            variant: :ghost,
            size: :sm,
            button_aria: { label: "Delete #{page.title}" },
            data: { turbo_confirm: "Delete this page?" }
          )
        end
      end
    end

    def render_empty
      render EmptyState.new(
        title: @q.present? ? "No results for “#{@q}”" : (empty_status_title || "No pages yet"),
        description: @q.present? ? "Try a different search or clear the filters." : "Pages are for timeless content — about, contact, terms.",
        level: 3
      ) do |state|
        unless @q.present?
          state.action(Button.new("Write your first page", href: new_admin_page_path, icon: :plus))
        end
      end
    end

    def empty_status_title
      case @status
      when "published" then "No published pages"
      when "draft" then "No drafts"
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
  end
end
