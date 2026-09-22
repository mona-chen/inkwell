module ImageSources
  # Per-site configuration. Every provider works out of the box, so activating the plugin is
  # enough to get photos, logos, avatars and screenshots; these settings exist to narrow that
  # (or to raise a quota). Values live in site settings and keys fall back to ENV.
  module Settings
    PROVIDER_KEYS = %w[openverse simple_icons dice_bear microlink].freeze
    NONE = "none".freeze
    PROVIDER_LABELS = {
      "openverse" => "Openverse — openly licensed photos",
      "simple_icons" => "Simple Icons — brand and product logos",
      "dice_bear" => "DiceBear — avatars and mascots",
      "microlink" => "Microlink — screenshots of a live URL"
    }.freeze

    class << self
      def enabled_providers(site)
        raw = site.setting("image_sources_providers").to_s.strip
        return PROVIDER_KEYS if raw.blank? # never configured → everything on
        return [] if raw == NONE

        raw.split(/[,\s]+/).map(&:strip).select { |key| PROVIDER_KEYS.include?(key) }
      end

      def provider_enabled?(site, key)
        enabled_providers(site).include?(key.to_s)
      end

      # Openverse indexes non-commercial licences too. A business page cannot use those, so the
      # default asks Openverse for commercial-use images only; a site can opt into the fuller
      # index deliberately.
      def openverse_license(site)
        site.setting("image_sources_openverse_license").to_s == "all" ? "all" : "commercial"
      end

      def microlink_api_key(site)
        site.setting("image_sources_microlink_api_key").presence || ENV["MICROLINK_API_KEY"].presence
      end
    end
  end
end
