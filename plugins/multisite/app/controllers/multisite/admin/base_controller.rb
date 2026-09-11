module Multisite
  module Admin
    class BaseController < ::Admin::BaseController
      include Multisite::RouteHelpers

      before_action :require_super_admin!

      private

      def require_super_admin!
        unless current_user&.admin? || current_user&.super_admin?
          redirect_to admin_root_path, alert: "You need super-admin access to manage sites."
        end
      end
    end
  end
end
