class MediaFilesController < ApplicationController
  def show
    media_item = Current.site.media_items.find(params[:id])
    raise ActiveRecord::RecordNotFound unless media_item.file.attached?

    redirect_to rails_blob_path(media_item.file, disposition: "inline"), allow_other_host: false
  end
end
