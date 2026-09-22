require "uri"

module ImageSources
  module Adapters
    # A screenshot of a live URL — the "show the real product" picture, a link preview, or a
    # hero built from the site being referenced. Microlink renders the page on its own
    # infrastructure, so the query is a URL rather than a search phrase.
    #
    # Policy: the free tier allows 25 requests a day and no key is required to start, so the
    # adapter works immediately and an optional key raises the quota. Its terms grant use of the
    # service and require that the credit not be stripped from the material, which is why the
    # screenshot is filed with Microlink as the creator.
    class Microlink < Adapter
      provider "microlink"
      kind "screenshot"
      label "Microlink"
      homepage "https://microlink.io"
      default_license "Screenshot via Microlink"
      attribution_required true
      may_hotlink false

      ENDPOINT = "https://api.microlink.io/".freeze
      HTTP_URL = %r{\Ahttps?://}i

      def api_key = Settings.microlink_api_key(site)

      def search(query:, limit:)
        url = query.to_s.strip
        raise Error, "A screenshot needs a full http(s) URL, for example https://example.com." unless url.match?(HTTP_URL)

        uri = URI.parse(ENDPOINT)
        uri.query = URI.encode_www_form(url: url, screenshot: "true", meta: "false", meta_override: "false")
        payload = Http.get_json(uri.to_s, headers: headers, timeout: 60)
        raise Error, payload["message"].presence || "Microlink could not capture that page." unless payload["status"] == "success"

        shot = payload.dig("data", "screenshot")
        raise Error, "Microlink did not return a screenshot for that URL." unless shot.is_a?(Hash) && shot["url"].present?

        [ build_result(url, shot) ]
      end

      private

      def headers
        api_key.present? ? { "x-api-key" => api_key } : {}
      end

      def build_result(url, shot)
        host = begin
          URI.parse(url).host
        rescue URI::InvalidURIError
          nil
        end

        Result.new(
          title: "Screenshot of #{host.presence || url}",
          download_url: shot["url"],
          page_url: url,
          creator: "Microlink",
          creator_url: homepage,
          license: default_license,
          license_url: "#{homepage}/tos"
        )
      end
    end
  end
end
