require "net/http"
require "json"
require "base64"

module AiWriter
  # Thin client for an OpenAI-compatible image endpoint (POST /images/generations).
  #
  # Image generation is opt-in: it counts as configured only when an image model is named, so
  # a chat key that belongs to a text-only provider never turns the image tool on by itself.
  # The base URL and key fall back to the chat connection (ai_base_url / ai_api_key / ENV), so
  # one OpenAI-compatible key can serve both when the provider serves images.
  class ImageClient
    DEFAULT_MODEL = "gpt-image-1"
    MAX_IMAGE_BYTES = 12 * 1024 * 1024
    MAX_PROMPT_LENGTH = 4000

    class Error < StandardError; end

    def initialize(site:)
      @site = site
    end

    # Naming the model is the switch: the settings page leaves it blank to keep image
    # generation off, and get_capabilities reads this to decide whether the Copilot may
    # advertise the tool at all.
    def configured?
      model.present? && api_key.present?
    end

    def model
      @site.setting("ai_image_model").presence
    end

    # Returns { bytes:, content_type:, filename: } for a generated picture. Providers answer
    # either with inline base64 (gpt-image-1) or with a temporary URL (dall-e-3 and friends);
    # both shapes land here as bytes so the file is stored in the site's own media library.
    def generate(prompt:, size: nil)
      raise Error, "Describe the image you want to generate." if prompt.to_s.strip.blank?
      raise Error, "Image generation is not configured — name an image model in Settings → Copilot." unless configured?

      payload = { model: model, prompt: prompt.to_s.strip[0, MAX_PROMPT_LENGTH], n: 1 }
      payload[:size] = size if size.to_s.match?(/\A\d{2,5}x\d{2,5}\z/)

      response = http.post("/images/generations", payload.to_json,
                           "Content-Type" => "application/json", "Authorization" => "Bearer #{api_key}")
      unless response.is_a?(Net::HTTPSuccess)
        raise Error, "Image request failed (#{response.code}): #{provider_message(response)}"
      end

      datum = JSON.parse(response.body).dig("data", 0) || {}
      if (encoded = datum["b64_json"].presence)
        { bytes: Base64.decode64(encoded), content_type: "image/png", filename: filename_for("image/png") }
      elsif (remote = datum["url"].presence)
        download(remote)
      else
        raise Error, "The image provider returned no image."
      end
    rescue Error
      raise
    rescue StandardError => e
      raise Error, e.message
    end

    private

    def download(url, redirects = 2)
      uri = URI.parse(url.to_s)
      raise Error, "The image provider returned an unusable URL." unless uri.is_a?(URI::HTTP)

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https",
                                 open_timeout: 30, read_timeout: 180) { |net| net.get(uri.request_uri) }

      # is_a? rather than a case/when, matching AiWriter::Client: the response object is only
      # ever asked what it is.
      if response.is_a?(Net::HTTPSuccess)
        bytes = response.body.to_s
        raise Error, "The generated image was too large to store." if bytes.bytesize > MAX_IMAGE_BYTES

        type = response["content-type"].to_s.split(";").first.to_s.strip
        type = "image/png" unless type.start_with?("image/")
        { bytes: bytes, content_type: type, filename: filename_for(type) }
      elsif response.is_a?(Net::HTTPRedirection)
        raise Error, "The generated image could not be downloaded (too many redirects)." if redirects <= 0

        download(response["location"], redirects - 1)
      else
        raise Error, "The generated image could not be downloaded (#{response.code})."
      end
    end

    def provider_message(response)
      body = response.body.to_s
      parsed = JSON.parse(body) rescue nil
      parsed&.dig("error", "message").presence || body[0, 200]
    end

    def filename_for(content_type)
      extension = { "image/png" => "png", "image/jpeg" => "jpg", "image/webp" => "webp", "image/gif" => "gif" }[content_type] || "png"
      "ai-image-#{Time.now.utc.strftime('%Y%m%d%H%M%S')}-#{SecureRandom.hex(3)}.#{extension}"
    end

    def base_url
      (@site.setting("ai_image_base_url").presence || @site.setting("ai_base_url").presence ||
        ENV["OPENAI_BASE_URL"] || Client::DEFAULT_BASE_URL).to_s.sub(%r{/+\z}, "")
    end

    def api_key
      @site.setting("ai_image_api_key").presence || @site.setting("ai_api_key").presence || ENV["OPENAI_API_KEY"]
    end

    def http
      @http ||= begin
        uri = URI.parse(base_url)
        net = Net::HTTP.new(uri.host, uri.port)
        net.use_ssl = uri.scheme == "https"
        net.open_timeout = 60
        net.read_timeout = 300
        net
      end
    end
  end
end
