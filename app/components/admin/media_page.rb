# frozen_string_literal: true

module Admin
  # Media library: upload dropzone, search + type filter, and a rich grid of items.
  # Clicking an item opens its details (alt/caption edit, delete) in a dialog.
  class MediaPage < ApplicationComponent
    TYPES = [["All", nil], ["Images", "image"], ["Documents", "document"]].freeze

    def initialize(media_items:, type: nil, q: nil)
      @media_items = media_items
      @type = type
      @q = q
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Media library",
            subtitle: "#{pluralize(@media_items.total_count, "file")} in your library"
          )
        end
      end

      render_filters

      Grid(cols: "1 xl:4", gap: 6) do
        div(class: "xl:col-span-3") do
          render Grid.new(cols: "2 sm:3 lg:4", gap: 4, id: "media_grid") do
            if @media_items.empty?
              div(id: "media_empty_state", class: "col-span-full") do
                render EmptyState.new(
                  title: @q.present? ? "No results for “#{@q}”" : "No media yet",
                  description: @q.present? ? "Try a different search or clear the filters." : "Upload images and documents to use across your site.",
                  level: 3,
                  variant: :borderless
                )
              end
            else
              @media_items.each do |item|
                render MediaItem.new(item: item)
              end
            end
          end
          render Pagination.new(pagy: @pagy) if @pagy
        end

        div(class: "xl:col-span-1") do
          render_upload_zone
        end
      end
    end

    private

    def render_filters
      div(class: "mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between") do
        div(class: "flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1") do
          TYPES.each do |(label, value)|
            current = @type == value || (value.nil? && @type.nil?)
            a(
              href: admin_media_path(type: value, q: @q),
              class: "rounded-md px-3 py-1.5 text-sm font-medium transition-colors #{current ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}"
            ) { label }
          end
        end

        form_with(url: admin_media_path, method: :get, class: "sm:w-64") do |f|
          div(class: "relative") do
            span(class: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground") do
              render Icon.new(:search, size: :sm)
            end
            f.search_field :q,
              value: @q,
              placeholder: "Search media…",
              class: "w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          end
        end
      end
    end

    def render_upload_zone
      div(class: "xl:sticky xl:top-0") do
        render Card.new do |card|
          card.title { "Upload" }
          card.body do
            form_with(
              url: admin_media_path,
              method: :post,
              multipart: true,
              data: { controller: "auto-submit" }
            ) do |f|
              label(
                for: "file",
                class: "group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-10 cursor-pointer text-center transition-all hover:border-primary/50 hover:bg-muted/50"
              ) do
                span(class: "mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform group-hover:scale-110") do
                  render Icon.new(:upload, size: :md)
                end
                span(class: "text-sm font-medium text-foreground") { "Upload files" }
                span(class: "mt-1 text-xs text-muted-foreground") { "Images and documents" }
                f.file_field :file, class: "hidden", data: { action: "change->auto-submit#submit" }
              end
            end
          end
          card.footer do
            p(class: "text-xs text-muted-foreground") do
              "PNG, JPG, WebP, GIF, PDF"
            end
          end
        end
      end
    end
  end
end
