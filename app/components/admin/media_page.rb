# frozen_string_literal: true

module Admin
  # Media library: toolbar with the file count, an auto-submitting upload drop
  # zone, and a grid of thumbnails. Rendered from Admin::MediaController#index.
  # Uploads post via Turbo; create.turbo_stream.erb prepends the new item into
  # #media_grid.
  class MediaPage < ApplicationComponent
    def initialize(media_items:)
      @media_items = media_items
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Media",
            subtitle: pluralize(@media_items.total_count, "file")
          )
        end
      end

      render Card.new do |card|
        card.body do
          form_with(
            url: admin_media_path,
            method: :post,
            multipart: true,
            data: { controller: "auto-submit" }
          ) do |f|
            label(
              for: "file",
              class: "group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 cursor-pointer text-center transition-all hover:border-primary/50 hover:bg-muted/50"
            ) do
              span(class: "mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform group-hover:scale-110") do
                render Icon.new(:upload, size: :md)
              end
              span(class: "text-sm font-medium text-foreground") { "Click to upload files" }
              span(class: "mt-1 text-xs text-muted-foreground") { "Images, documents and more — dropped here or chosen from disk" }
              f.file_field :file, class: "hidden", data: { action: "change->auto-submit#submit" }
            end
          end
        end
      end

      render Grid.new(cols: "2 sm:3 lg:6", gap: 4, id: "media_grid") do
        if @media_items.empty?
          div(class: "col-span-full") do
            render EmptyState.new(
              title: "No media yet",
              description: "Drop a file above to upload your first image.",
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
    end
  end
end
