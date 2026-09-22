require "uri"

module ImageSources
  module Adapters
    # Openverse is the photo source that needs no account: it indexes openly-licensed images
    # from Flickr, Wikimedia, museums and more, and returns the licence and the creator with
    # every result. Its `license_type` filter is the point — by default we ask only for images a
    # business may actually use, and a site can widen that to the full index in settings.
    class Openverse < Adapter
      provider "openverse"
      kind "photo"
      label "Openverse"
      homepage "https://openverse.org"
      default_license "Creative Commons (see source)"
      attribution_required true
      may_hotlink false

      ENDPOINT = "https://api.openverse.org/v1/images/".freeze
      MAX_RESULTS = 20

      def search(query:, limit:)
        uri = URI.parse(ENDPOINT)
        uri.query = URI.encode_www_form(
          q: query,
          page_size: limit.to_i.clamp(1, MAX_RESULTS),
          license_type: Settings.openverse_license(site),
          mature: "false"
        )
        payload = Http.get_json(uri.to_s)
        Array(payload["results"]).filter_map { |row| build_result(row) }
      end

      private

      def build_result(row)
        download = row["url"].presence
        return unless download

        Result.new(
          title: row["title"].presence,
          download_url: download,
          # Originals are often print-resolution; the Openverse thumbnail is the graceful
          # fallback when the original is too heavy to file.
          fallback_url: (row["thumbnail"].presence if row["thumbnail"].presence != download),
          page_url: row["foreign_landing_url"].presence || row["detail_url"].presence,
          creator: row["creator"].presence,
          creator_url: row["creator_url"].presence,
          license: license_label(row),
          license_url: row["license_url"].presence
        )
      end

      # Openverse describes a licence as code + version ("by-sa", "2.0"); the file should carry
      # something a person reading the media library understands.
      def license_label(row)
        code = row["license"].to_s.strip
        return nil if code.blank?
        return "CC0 1.0" if code.casecmp("cc0").zero?

        version = row["license_version"].to_s.strip
        [ "CC", code.upcase, version ].reject(&:blank?).join(" ")
      end
    end
  end
end
