module ImageSources
  # Which sources this site may use. Everything defaults to on, so this page is about narrowing
  # (turning a source off, restricting Openverse to commercially usable licences) or raising a
  # quota with a key — never about making the feature work in the first place.
  class SettingsController < Admin::BaseController
    def show
      render ImageSources::SettingsPage.new(site: Current.site)
    end

    def update
      raw = params[:image_sources] || {}
      providers = Array(raw[:providers]).map(&:to_s).select { |key| Settings::PROVIDER_KEYS.include?(key) }

      Current.site.set_setting!("image_sources_providers", providers.presence&.join(",") || Settings::NONE)
      Current.site.set_setting!("image_sources_openverse_license", raw[:openverse_license].to_s == "all" ? "all" : "commercial")
      Current.site.set_setting!("image_sources_microlink_api_key", raw[:microlink_api_key].to_s.strip)

      redirect_to settings_url, notice: "Image sources saved."
    end

    private

    def settings_url
      ImageSources::Engine.routes.url_helpers.settings_path
    end
  end
end
