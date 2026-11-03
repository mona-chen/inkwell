module Admin
  class ThemePartsController < BaseController
    def index
      render json: { theme: Current.site.active_theme, parts: parts.declarations.keys.map { |key| summary(key) } }
    end

    def show
      part = parts.read(params[:part_key])
      return head :not_found unless part

      render json: part.merge(body: part[:body].to_s)
    end

    def update
      override = parts.write!(params[:part_key], params[:body].to_s)
      render json: { key: override.part_key, body: override.body, revision: override.revision }
    rescue ThemePackages::Invalid => error
      render json: { error: error.message }, status: :unprocessable_entity
    end

    def reset
      parts.reset!(params[:part_key])
      head :no_content
    end

    private

    def parts
      @parts ||= ThemeRuntime::Parts.new(site: Current.site, theme_slug: Current.site.active_theme)
    end

    def summary(key)
      part = parts.read(key)
      { key: key, declaration: part[:declaration], source: part[:source], revision: part[:revision] }
    end
  end
end
