module Admin
  class MediaController < BaseController
    before_action :set_media_item, only: %i[update destroy]

    def index
      @media_items = Current.site.media_items.includes(file_attachment: :blob)
      @media_items = @media_items.where(type: params[:type]) if params[:type].present? && %w[image document].include?(params[:type])
      @media_items = @media_items.where("active_storage_blobs.filename ILIKE ?", "%#{params[:q]}%") if params[:q].present?
      @media_items = @media_items.order(created_at: :desc).page(params[:page])

      if params[:picker].present?
        render "admin/media/picker", layout: false
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
        else
          format.html { redirect_to admin_media_path, alert: @media_item.errors.full_messages.to_sentence }
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
