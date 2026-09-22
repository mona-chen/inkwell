require "stringio"
require "securerandom"

module ImageSources
  # Turning a search hit into a real media item — the whole reason this plugin is a server-side
  # proxy rather than a list of links.
  #
  # A published page must never point at a stock library's CDN: the providers' own terms forbid
  # it (Pixabay: "permanent hotlinking … is not allowed … please download them to your server
  # first"), and a URL we do not control can vanish or start returning a paywall. So the bytes
  # are fetched once, filed in this site's library, and the provenance is written onto the file
  # — which is also what lets a licence's credit requirement be honoured later, and what keeps
  # that credit intact even if this plugin is switched off afterwards.
  module Sideload
    class Error < StandardError; end

    MAX_BYTES = 12 * 1024 * 1024
    ALT_MAX = 180

    ALLOWED_TYPES = %w[image/png image/jpeg image/jpg image/webp image/gif image/svg+xml image/avif].freeze
    EXTENSIONS = {
      "image/png" => "png", "image/jpeg" => "jpg", "image/jpg" => "jpg", "image/webp" => "webp",
      "image/gif" => "gif", "image/svg+xml" => "svg", "image/avif" => "avif"
    }.freeze
    TYPE_BY_EXTENSION = { "png" => "image/png", "jpg" => "image/jpeg", "jpeg" => "image/jpeg",
                          "webp" => "image/webp", "gif" => "image/gif", "svg" => "image/svg+xml",
                          "avif" => "image/avif" }.freeze

    class << self
      def call(adapter:, result:, site:, user:)
        # source_url is the exact remote resource, which is what makes it a sound identity: two
        # searches for the same picture must reuse the file, and two different brands must never
        # collide just because they came from the same library. (The human-facing page for the
        # picture goes in credit_url.)
        source_url = result.download_url
        existing = site.media_items.find_by(source_url: source_url)
        return existing if existing

        download = download_for(result)
        content_type = content_type_for(download[:content_type], result)
        raise Error, "That result is not an image this site can store." unless ALLOWED_TYPES.include?(content_type)

        item = site.media_items.new(
          uploaded_by: user,
          alt_text: alt_text(adapter, result),
          provider: adapter.provider,
          source_url: source_url,
          credit: result.creator.presence,
          # The specific page for this picture beats the library's front door: it is what a reader
          # following a licence obligation actually needs.
          credit_url: result.page_url.presence || result.creator_url.presence,
          license: result.license.presence || adapter.default_license
        )
        item.file.attach(io: StringIO.new(download[:bytes]),
                         filename: filename_for(adapter, result, content_type),
                         content_type: content_type)
        raise Error, item.errors.full_messages.to_sentence unless item.save

        item
      end

      private

      # Originals can be heavier than a site wants to host; the adapter's fallback (a thumbnail
      # the provider offers) is the second chance rather than a failed search.
      def download_for(result)
        Http.get_bytes(result.download_url, timeout: 30, max_bytes: MAX_BYTES)
      rescue Error, Http::Error
        raise unless result.fallback_url.present?

        Http.get_bytes(result.fallback_url, timeout: 30, max_bytes: MAX_BYTES)
      end

      # Some CDNs answer without a useful content type; the URL's extension is the tiebreaker,
      # and a genuinely unknown type is refused rather than stored as an unopenable file.
      def content_type_for(reported, result)
        type = reported.to_s.strip.downcase
        return type if ALLOWED_TYPES.include?(type)

        extension = File.extname(URI.parse(result.download_url.to_s).path.to_s).delete(".").downcase
        TYPE_BY_EXTENSION[extension].to_s
      rescue URI::InvalidURIError
        ""
      end

      def alt_text(adapter, result)
        text = result.title.presence || "#{adapter.label} image"
        text.to_s.truncate(ALT_MAX)
      end

      def filename_for(adapter, result, content_type)
        slug = result.title.to_s.parameterize.first(48).presence || adapter.kind
        "#{adapter.provider}-#{slug}-#{SecureRandom.hex(3)}.#{EXTENSIONS.fetch(content_type, 'bin')}"
      end
    end
  end
end
