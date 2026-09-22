require "uri"

module ImageSources
  module Adapters
    # Brand and product logos from Simple Icons: ~3,500 marks, CC0, and the set that every
    # "logo wall" or "as seen in" strip actually wants. Iconify's index gives real search over
    # that set (the upstream project ships no search API), and the bytes come from the official
    # Simple Icons CDN, which can bake a fill colour into the SVG — a black mark is invisible on
    # a dark page, so the caller may name one.
    #
    # The marks are trademarks; CC0 covers the drawing, not the brand. The file's provenance
    # carries that note so a page owner can see what they are using.
    class SimpleIcons < Adapter
      provider "simple_icons"
      kind "logo"
      label "Simple Icons"
      homepage "https://simpleicons.org"
      default_license "CC0 1.0 (trademark belongs to the brand owner)"
      attribution_required false
      may_hotlink false

      SEARCH_ENDPOINT = "https://api.iconify.design/search".freeze
      CDN = "https://cdn.simpleicons.org".freeze
      LICENSE_URL = "https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md".freeze
      MAX_RESULTS = 20
      HEX = /\A[0-9a-fA-F]{3,8}\z/

      def search(query:, limit:)
        uri = URI.parse(SEARCH_ENDPOINT)
        uri.query = URI.encode_www_form(query: query, prefix: "simple-icons", limit: limit.to_i.clamp(1, MAX_RESULTS))
        payload = Http.get_json(uri.to_s)
        Array(payload["icons"]).filter_map { |name| build_result(name.to_s.split(":", 2).last) }
      end

      private

      def build_result(slug)
        return if slug.blank?

        Result.new(
          title: "#{slug.tr('-', ' ').titleize} logo",
          download_url: "#{CDN}/#{slug}#{color_suffix}",
          page_url: "https://github.com/simple-icons/simple-icons/blob/develop/icons/#{slug}.svg",
          creator: "Simple Icons",
          creator_url: "https://github.com/simple-icons/simple-icons",
          license: default_license,
          license_url: LICENSE_URL
        )
      end

      # The CDN accepts /{slug}/{hex} and writes the fill into the file, which is the only way
      # to recolour an SVG that will be served through an <img>.
      def color_suffix
        hex = options[:color].to_s.delete("#")
        HEX.match?(hex) ? "/#{hex}" : ""
      end
    end
  end
end
