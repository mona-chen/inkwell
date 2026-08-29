module Admin
  class MediaController < BaseController
    before_action :set_media_item, only: %i[update destroy]

    def index
      @media_items = Current.site.media_items.includes(file_attachment: :blob)
      @media_items = @media_items.select { |item| item.type == params[:type] } if params[:type].present? && %w[image document].include?(params[:type])
      @media_items = @media_items.where("active_storage_blobs.filename ILIKE ?", "%#{params[:q]}%") if params[:q].present?
      @media_items = @media_items.order(created_at: :desc).page(params[:page])

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

    def set_media_item
      @media_item = Current.site.media_items.find(params[:id])
    end

    def media_params
      params.require(:media_item).permit(:alt_text, :caption)
    end
  end
end
