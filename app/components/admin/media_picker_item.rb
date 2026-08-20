# frozen_string_literal: true

module Admin
  # A click-to-insert media item for the picker dialog. Emits the selected URL via a
  # bubbling CustomEvent that the media-picker Stimulus controller listens for.
  class MediaPickerItem < ApplicationComponent
    def initialize(item:)
      @item = item
    end

    def view_template
      button(
        type: "button",
        data: {
          controller: "media-picker-item",
          action: "click->media-picker-item#select",
          url: @item.url,
          id: @item.id.to_s,
          alt: @item.alt_text.to_s
        },
        class: "group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted transition-all hover:border-primary/50 hover:shadow-sm"
      ) do
        if @item.image?
          img(src: @item.thumbnail_url, class: "h-full w-full object-cover", alt: @item.alt_text, loading: "lazy")
          span(
            class: "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-6 text-left text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
          ) { @item.file.filename.to_s }
        else
          div(class: "flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center") do
            render Icon.new(:file, size: :sm)
            span(class: "line-clamp-2 text-[10px] text-muted-foreground") { @item.file.filename.to_s }
          end
        end
      end
    end
  end
end
