module Admin
  class MediaController < BaseController
    def index
      @media_items = Current.site.media_items.includes(file_attachment: :blob).order(created_at: :desc).page(params[:page])
      render Admin::MediaPage.new(media_items: @media_items)
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

    def destroy
      Current.site.media_items.find(params[:id]).destroy
      redirect_to admin_media_path, notice: "Deleted."
    end
  end
end
