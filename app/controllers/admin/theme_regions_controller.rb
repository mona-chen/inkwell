module Admin
  class ThemeRegionsController < BaseController
    def index
      render json: { regions: regions.read, theme: Current.site.active_theme, revision: regions_revision }
    end

    def show
      render json: { region: regions.read_one(params[:region_key]), theme: Current.site.active_theme, revision: regions_revision }
    end

    def update
      regions = ThemeRuntime::EditableRegions.new(site: Current.site, theme_slug: Current.site.active_theme)
      override = regions.write!(params[:region_key], region_data)
      respond_to do |format|
        format.json { render json: { key: override.region_key, data: override.data, revision: override.revision } }
        format.html { redirect_to admin_pages_path, notice: "Theme region saved." }
      end
    rescue ThemePackages::Invalid => error
      respond_to do |format|
        format.json { render json: { error: error.message }, status: :unprocessable_entity }
        format.html { redirect_to admin_pages_path, alert: error.message }
      end
    end

    def reset
      ThemeRuntime::EditableRegions.new(site: Current.site, theme_slug: Current.site.active_theme).reset!(params[:region_key])
      respond_to do |format|
        format.json { head :no_content }
        format.html { redirect_to admin_pages_path, notice: "Theme region reset." }
      end
    end

    private

    def regions
      @regions ||= ThemeRuntime::EditableRegions.new(site: Current.site, theme_slug: Current.site.active_theme)
    end

    def regions_revision
      Digest::SHA256.hexdigest(regions.read.to_json)
    end

    def region_data
      raw = params[:data]
      raw.is_a?(ActionController::Parameters) ? raw.to_unsafe_h : (raw.is_a?(Hash) ? raw : { "value" => raw })
    end
  end
end
