require "uri"
require "digest"

module ImageSources
  module Adapters
    # Avatars and mascots from DiceBear: deterministic, generated, and free to use — the answer
    # to "this design needs a face or a creature" without inventing a person or a trademarked
    # character. The query is the seed, so the same request always yields the same character and
    # a page's avatar stays stable across rebuilds.
    class DiceBear < Adapter
      provider "dice_bear"
      label "DiceBear"
      homepage "https://www.dicebear.com"
      default_license "DiceBear (see the style's licence)"
      attribution_required true
      may_hotlink false

      CDN = "https://api.dicebear.com/9.x".freeze

      STYLES = {
        "avatar" => %w[lorelei notionists adventurer personas],
        "mascot" => %w[bottts adventurer-neutral fun-emoji shapes]
      }.freeze

      KIND_LABELS = { "avatar" => "Avatar", "mascot" => "Mascot" }.freeze

      # Some styles are CC0, some CC BY 4.0; the page owner can always follow the style page.
      STYLE_LICENSES = {
        "lorelei" => "CC0 1.0", "notionists" => "CC0 1.0", "personas" => "CC0 1.0",
        "bottts" => "CC0 1.0", "shapes" => "CC0 1.0",
        "adventurer" => "CC BY 4.0", "adventurer-neutral" => "CC BY 4.0", "fun-emoji" => "CC BY 4.0"
      }.freeze

      def kind = options[:kind].to_s
      def label = "DiceBear #{KIND_LABELS.fetch(kind, kind.titleize)}"

      def search(query:, limit:)
        seed = seed_for(query)
        Array(STYLES[kind]).first(limit.to_i.clamp(1, 8)).map { |style| build_result(style, seed) }
      end

      private

      def build_result(style, seed)
        uri = URI.parse("#{CDN}/#{style}/png")
        uri.query = URI.encode_www_form(seed: seed, size: 512)

        Result.new(
          title: "#{KIND_LABELS.fetch(kind, kind.titleize)} “#{seed.tr('-', ' ')}” (#{style.tr('-', ' ').titleize})",
          download_url: uri.to_s,
          page_url: "#{homepage}/styles/#{style}/",
          creator: "DiceBear (#{style})",
          creator_url: homepage,
          license: STYLE_LICENSES.fetch(style, default_license),
          license_url: "#{homepage}/styles/#{style}/"
        )
      end

      def seed_for(query)
        query.to_s.parameterize.presence || Digest::MD5.hexdigest(query.to_s)
      end
    end
  end
end
