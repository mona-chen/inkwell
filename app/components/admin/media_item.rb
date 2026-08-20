# frozen_string_literal: true

module Admin
  # A single media-library thumbnail: image (or filename fallback) with a hover
  # overlay exposing "Use" (media-picker callback) and a destructive delete.
  # Rendered both by MediaPage and prepended by create.turbo_stream.erb.
  class MediaItem < ApplicationComponent
    def initialize(item:)
      @item = item
    end

    def view_template
      div(
        id: dom_id(@item),
        class: "group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition-all hover:shadow-md"
      ) do
        if @item.file.content_type.to_s.start_with?("image/")
          img(src: @item.thumbnail_url, class: "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105", alt: @item.alt_text)
        else
          div(
            class: "flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground"
          ) do
            @item.file.filename
          end
        end

        div(
          class: "absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100"
        ) do
          button(
            type: "button",
            data: { action: "media-picker#select", url: @item.url },
            class: "rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-900 hover:bg-gray-100"
          ) { "Use" }

          render ButtonTo.new(
            "Delete",
            href: admin_media_path(@item),
            method: :delete,
            variant: :destructive,
            size: :xs,
            data: { turbo_confirm: "Delete this file?" }
          )
        end
      end
    end
  end
end
