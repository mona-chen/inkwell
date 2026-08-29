# frozen_string_literal: true

module Admin
  # A media-library item: thumbnail (or file-type icon for documents), filename, and a
  # hover overlay to open details (alt/caption edit + delete) or, in picker mode, insert.
  # Rendered by MediaPage and prepended by create.turbo_stream.erb.
  class MediaItem < ApplicationComponent
    def initialize(item:)
      @item = item
    end

    def view_template
      div(
        id: dom_id(@item),
        data: { controller: "media-item" },
        class: "group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition-all hover:shadow-md"
      ) do
        render_preview
        render_hover_overlay
        render_details_dialog
      end
    end

    private

    def render_preview
      if @item.image?
        img(src: @item.thumbnail_url, class: "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105", alt: @item.alt_text, loading: "lazy")
      else
        div(class: "flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center") do
          span(class: "flex h-12 w-12 items-center justify-center rounded-lg bg-background/70 text-muted-foreground") do
            render Icon.new(:file, size: :md)
          end
          span(class: "line-clamp-2 text-xs text-muted-foreground") { @item.file.filename.to_s }
        end
      end
    end

    def render_hover_overlay
      div(class: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 pt-10 opacity-0 transition-opacity group-hover:opacity-100") do
        button(
          type: "button",
          data: { action: "media-item#open" },
          class: "rounded-md bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
        ) { "Details" }

        render ButtonTo.new(
          "Delete",
          href: admin_medium_path(@item),
          method: :delete,
          variant: :destructive,
          size: :xs,
          data: { turbo_confirm: "Delete this file?" }
        )
      end
    end

    def render_details_dialog
      dialog(
        data: { media_item_target: "dialog", action: "click->media-item#backdropClose" },
        class: "m-auto rounded-2xl border border-border bg-background p-0 shadow-2xl backdrop:bg-black/40"
      ) do
        div(class: "w-[26rem] max-w-full") do
          div(class: "flex items-center justify-between border-b border-border px-5 py-3") do
            h3(class: "text-sm font-semibold text-foreground") { "Media details" }
            button(
              type: "button",
              data: { action: "media-item#close" },
              aria: { label: "Close" },
              class: "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            ) do
              render Icon.new(:x, size: :sm)
            end
          end

          div(class: "p-5") do
            if @item.image?
              img(src: @item.url, class: "mb-4 max-h-48 w-full rounded-lg object-contain", alt: @item.alt_text)
            else
              div(class: "mb-4 flex items-center gap-3 rounded-lg bg-muted p-4") do
                render Icon.new(:file, size: :md)
                span(class: "break-all text-sm text-muted-foreground") { @item.file.filename }
              end
            end

            form_with(model: @item, url: admin_medium_path(@item), method: :patch, class: "space-y-3") do |f|
              div do
                f.label :alt_text, class: "mb-1 block text-xs font-medium text-muted-foreground"
                f.text_field :alt_text, class: "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              end
              div do
                f.label :caption, class: "mb-1 block text-xs font-medium text-muted-foreground"
                f.text_field :caption, class: "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              end
              div(class: "flex items-center justify-between pt-1") do
                a(
                  href: @item.url,
                  target: "_blank",
                  rel: "noopener",
                  class: "inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                ) do
                  render Icon.new(:external_link, size: :sm)
                  "Open original"
                end
                f.submit "Save", class: "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
              end
            end
          end
        end
      end
    end
  end
end
