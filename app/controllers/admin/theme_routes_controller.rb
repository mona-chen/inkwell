module Admin
  class ThemeRoutesController < BaseController
    before_action :set_route

    def edit
    end

    def update
      @route.with_lock do
        unless current_revision?
          @stale = true
          raise ActiveRecord::Rollback
        end
        @route.assign_attributes(route_params)
        @route.save!
      end
      if @stale
        flash.now[:alert] = "This theme route changed. Review the latest values before saving."
        return render :edit, status: :conflict
      end
      redirect_to edit_admin_theme_route_path(@route), notice: "Theme route saved."
    rescue ActiveRecord::RecordInvalid
      render :edit, status: :unprocessable_entity
    end

    def publish
      @route.publish!
      redirect_to edit_admin_theme_route_path(@route), notice: "Theme route published."
    end

    def unpublish
      @route.unpublish!
      redirect_to edit_admin_theme_route_path(@route), notice: "Theme route moved to draft."
    end

    def restore
      revision = @route.revisions.find(params[:revision_id])
      @route.restore!(revision)
      redirect_to edit_admin_theme_route_path(@route), notice: "Restored revision #{revision.revision_number}."
    end

    def preview
      path = @route.path.include?(":") ? "/" : @route.path
      redirect_to "#{path}?preview_theme=#{CGI.escape(@route.theme_release_id)}"
    end

    private

    def set_route
      @route = Current.site.theme_routes.find(params[:id])
    end

    def current_revision?
      return true if params.dig(:theme_route, :revision).blank?

      params.dig(:theme_route, :revision).to_s == @route.revision.to_s
    end

    def route_params
      params.require(:theme_route).permit(
        :title_override, :seo_title, :meta_description, :canonical_url, :social_image_id,
        :robots, :schema_json, :status, :draft_data, :published_at, :navigation_location,
        :navigation_label, :navigation_position, :sitemap
      ).tap do |attributes|
        %w[schema_json draft_data].each do |key|
          next unless attributes[key].is_a?(String)

          attributes[key] = JSON.parse(attributes[key])
        rescue JSON::ParserError
          attributes[key] = {}
        end
      end
    end
  end
end
