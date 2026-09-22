require "stringio"

module AiWriter
  # Image generation for the Copilot. The model calls the client-side generate_image tool,
  # which posts here; the server holds the key, generates the picture, and files it in the
  # site's media library so the result is a normal, re-usable, purgeable media item rather
  # than a link to somebody else's storage. Nothing reaches the browser but the media URL.
  class ImagesController < Admin::BaseController
    def create
      client = ImageClient.new(site: Current.site)
      unless client.configured?
        render json: { error: "Image generation is not configured — name an image model in Settings → Copilot." },
               status: :unprocessable_entity
        return
      end

      generated = client.generate(prompt: params[:prompt], size: params[:size])
      item = Current.site.media_items.new(uploaded_by: current_user, alt_text: alt_text)
      item.file.attach(io: StringIO.new(generated[:bytes]), filename: generated[:filename],
                       content_type: generated[:content_type])

      if item.save
        render json: {
          id: item.id, url: item.url, alt: item.alt_text, kind: item.kind,
          width: item.file.blob.metadata["width"], height: item.file.blob.metadata["height"]
        }.compact
      else
        render json: { error: item.errors.full_messages.to_sentence }, status: :unprocessable_entity
      end
    rescue ImageClient::Error => e
      render json: { error: e.message }, status: :unprocessable_entity
    end

    private

    # The alt text is what makes the generated picture usable on the page, so the model is
    # asked for it; the prompt is a decent fallback when it forgets.
    def alt_text
      params[:alt].to_s.strip.presence || params[:prompt].to_s.strip.truncate(180).presence || "Generated image"
    end
  end
end
