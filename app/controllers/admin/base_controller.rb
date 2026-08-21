module Admin
  class BaseController < ApplicationController
    layout "admin"
    before_action :authenticate_user!
    before_action :require_admin_access!

    private

    def require_admin_access!
      redirect_to root_path, alert: "Not authorized" unless current_user&.can?(:manage_site) || current_user&.admin?
    end

    # Admin gets a plain 404 (the themed front-end page doesn't make sense in the dashboard).
    def render_not_found
      respond_to do |format|
        format.html { render plain: "Not found", status: :not_found }
        format.any { head :not_found }
      end
    end
  end
end
