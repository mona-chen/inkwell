module Multisite
  module Admin
    class SiteSwitcherController < ::Admin::BaseController
      include Multisite::RouteHelpers

      def create
        site = current_user.accessible_sites.active.find(params[:site_id])
        session["multisite.site_id"] = site.id
        session["multisite.site_domain"] = request.host
        Current.site = site
        redirect_to main_app.admin_root_path, notice: "Switched to #{site.name}."
      rescue ActiveRecord::RecordNotFound
        redirect_to main_app.admin_root_path, alert: "Site not found or inactive."
      end

      def destroy
        session.delete("multisite.site_id")
        session.delete("multisite.site_domain")
        Current.site = current_user.site
        redirect_to main_app.admin_root_path, notice: "Switched back to your primary site."
      end
    end
  end
end
