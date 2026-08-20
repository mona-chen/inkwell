module Admin
  class BaseController < ApplicationController
    layout "admin"
    before_action :authenticate_user!
    before_action :require_admin_access!

    private

    def require_admin_access!
      redirect_to root_path, alert: "Not authorized" unless current_user&.can?(:manage_site) || current_user&.admin?
    end
  end
end
