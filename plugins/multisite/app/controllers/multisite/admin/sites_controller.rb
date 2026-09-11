module Multisite
  module Admin
    class SitesController < BaseController
      before_action :find_site, only: %i[show edit update destroy activate deactivate]

      def index
        @sites = Site.all.order(:name).includes(:users, :posts, :pages)
        render Multisite::Admin::SitesPage.new(
          sites: @sites,
          current_user: current_user,
          site_creation_mode: Multisite::Settings.site_creation_mode
        )
      end

      def show
        redirect_to multisite_routes.edit_admin_site_path(@site)
      end

      def new
        @site = Site.new
        render Multisite::Admin::SiteFormPage.new(site: @site)
      end

      def create
        @site = Site.new(site_params)
        if @site.save
          add_custom_domain(@site)
          current_user.user_sites.create!(site: @site, role: "admin")
          redirect_to multisite_routes.admin_sites_path, notice: "Site \"#{@site.name}\" created."
        else
          render Multisite::Admin::SiteFormPage.new(site: @site, errors: @site.errors)
        end
      end

      def edit
        render Multisite::Admin::SiteFormPage.new(site: @site, server_ip: request.host)
      end

      def update
        if @site.update(site_params)
          add_custom_domain(@site)
          redirect_to multisite_routes.edit_admin_site_path(@site), notice: "Site updated."
        else
          render Multisite::Admin::SiteFormPage.new(site: @site, errors: @site.errors, server_ip: request.host)
        end
      end

      def destroy
        if @site.is_default?
          redirect_to multisite_routes.admin_sites_path, alert: "Cannot delete the default site."
          return
        end
        @site.destroy!
        redirect_to multisite_routes.admin_sites_path, notice: "Site deleted."
      end

      def activate
        @site.update!(active: true)
        redirect_to multisite_routes.admin_sites_path, notice: "Site activated."
      end

      def deactivate
        if @site.is_default?
          redirect_to multisite_routes.admin_sites_path, alert: "Cannot deactivate the default site."
          return
        end
        @site.update!(active: false)
        redirect_to multisite_routes.admin_sites_path, notice: "Site deactivated."
      end

      def remove_domain
        site = Site.find(params[:id])
        domain = site.custom_domains.find(params[:domain_id])
        domain.destroy!
        redirect_to multisite_routes.edit_admin_site_path(site), notice: "Domain #{domain.domain} removed."
      end

      def check_domain
        site = Site.find(params[:id])
        domain = site.custom_domains.find(params[:domain_id])
        server_ip = request.host
        result = domain.check_dns!(server_ip: server_ip)

        if result[:matched]
          redirect_to multisite_routes.edit_admin_site_path(site), notice: "DNS verified for #{domain.domain}."
        else
          redirect_to multisite_routes.edit_admin_site_path(site), alert: "DNS not matching for #{domain.domain}. Expected #{result[:expected]}, found #{result[:found].join(', ')}."
        end
      end

      def make_primary
        site = Site.find(params[:id])
        domain = site.custom_domains.find(params[:domain_id])
        old_primary = site.domain
        site.update!(domain: domain.domain)
        redirect_to multisite_routes.edit_admin_site_path(site), notice: "#{domain.domain} is now the primary domain."
      end

      def set_site_creation_mode
        Multisite::Settings.site_creation_mode = params[:mode]
        redirect_to multisite_routes.admin_sites_path, notice: "Site creation set to #{Multisite::Settings.site_creation_mode.tr('_', ' ')}."
      rescue ArgumentError
        redirect_to multisite_routes.admin_sites_path, alert: "Invalid site creation mode."
      end

      private

      def find_site
        @site = Site.find(params[:id])
      end

      def site_params
        params.require(:site).permit(:name, :domain, :subdomain, :is_default, :plan, :logo_url)
      end

      def add_custom_domain(site)
        domain = params[:custom_domain].to_s.strip.downcase
        return if domain.blank?
        return if site.custom_domains.exists?(domain: domain)
        site.custom_domains.create!(domain: domain, status: "setup_required")
      end
    end
  end
end
