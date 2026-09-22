module Admin
  class MediaController < BaseController
    before_action :set_media_item, only: %i[update destroy]

    def index
      @media_items = media_library_scope

      respond_to do |format|
        format.json { render json: { media: media_library_json(@media_items), total: @media_items.total_count } }
        format.html { render_media_index }
      end
    end

    def create
      @media_item = Current.site.media_items.build(uploaded_by: current_user, alt_text: params[:alt_text])
      @media_item.file.attach(params[:file])

      respond_to do |format|
        if @media_item.save
          format.turbo_stream # prepends the new item into the grid without a full reload
          format.html { redirect_to admin_media_path, notice: "Uploaded." }
          format.json { render json: { id: @media_item.id, url: @media_item.url, alt: @media_item.alt_text } }
        else
          format.html { redirect_to admin_media_path, alert: @media_item.errors.full_messages.to_sentence }
          format.json { render json: { errors: @media_item.errors.full_messages }, status: :unprocessable_entity }
        end
      end
    end

    def update
      if @media_item.update(media_params)
        redirect_to admin_media_path, notice: "Media updated."
      else
        redirect_to admin_media_path, alert: @media_item.errors.full_messages.to_sentence
      end
    end

    def destroy
      @media_item.destroy
      respond_to do |format|
        format.turbo_stream # removes the item from the grid without a full reload
        format.html { redirect_to admin_media_path, notice: "Deleted." }
      end
    end

    private

    # One scope for the human library and for the Copilot's list_media tool, so the AI browses
    # exactly the pictures the site owner sees. The search matches the file name or the alt
    # text — a person looks for "hero banner", not "8431-hero-2.png".
    def media_library_scope
      scope = Current.site.media_items.joins(:file_attachment => :blob)
      if params[:q].present?
        scope = scope.where("active_storage_blobs.filename ILIKE :q OR media_items.alt_text ILIKE :q", q: "%#{params[:q]}%")
      end
      if params[:type].present? && %w[image document].include?(params[:type])
        content_filter = params[:type] == "image" ? "active_storage_blobs.content_type LIKE 'image/%'" : "active_storage_blobs.content_type NOT LIKE 'image/%'"
        scope = scope.where(content_filter)
      end
      scope = scope.order(created_at: :desc).page(params[:page])
      scope = scope.per(json_per_page) if json_per_page
      scope
    end

    # The tool surface asks for a page of the library rather than a paged view.
    def json_per_page
      return unless request.format.json?

      [ [ params[:limit].to_i.nonzero? || 50, 1 ].max, 100 ].min
    end

    def media_library_json(items)
      items.map do |item|
        blob = item.file.blob
        {
          id: item.id,
          url: item.url,
          alt: item.alt_text.presence,
          caption: item.caption.presence,
          filename: blob.filename.to_s,
          kind: item.kind,
          width: blob.metadata["width"],
          height: blob.metadata["height"]
        }.compact
      end
    end

    def render_media_index
      if params[:picker].present?
        # Turbo Frame navigation sends the requesting frame id in the Turbo-Frame header;
        # the picker view must wrap its content in that same id or Turbo reports
        # "Content missing". Default to the block-editor picker frame. When the picker is
        # loaded directly (e.g. the Ink Builder's dialog iframe), render it as a standalone
        # page so Tailwind (bounded tiles) and the Stimulus picker controller load.
        @picker_frame = request.headers["Turbo-Frame"] || "media-picker-frame"
        if request.headers["Turbo-Frame"].present?
          render "admin/media/picker", layout: false
        else
          render "admin/media/picker", layout: "media_picker"
        end
      else
        render Admin::MediaPage.new(media_items: @media_items, type: params[:type], q: params[:q])
      end
    end

    def set_media_item
      @media_item = Current.site.media_items.find(params[:id])
    end

    def media_params
      params.require(:media_item).permit(:alt_text, :caption)
    end
  end
end
