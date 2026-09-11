module Multisite
  # Self-serve site creation: public signup that provisions a Site + User + grant, then
  # signs the new owner in and drops them on their new site's dashboard.
  #
  #   GET  /signup          → the (Phlex) registration form
  #   POST /signup          → creates the site, creates/signs-in the owner, redirects
  #   GET  /signup/new-site → a "create another site" form for already signed-in users
  #   POST /new-site        → creates an additional site for a signed-in user
  #
  # Subdomain claiming backs the whole flow: the owner picks "myblog", we mint both the
  # subdomain (`myblog.INKWELL_BASE_DOMAIN`) and store the full host in Site#domain so the
  # resolver can match it exactly.
  class RegistrationsController < ApplicationController
    include Multisite::RouteHelpers

    layout false

    before_action :redirect_signed_in_user_away_from_public_signup, only: :new, if: -> { user_signed_in? }
    before_action :authenticate_user!, only: %i[new_site create_site]
    before_action :check_site_creation_enabled, only: %i[new create new_site create_site]

    RESERVED_SUBDOMAINS = %w[
      admin api app assets blog cdn dashboard dev docs mail platform www
      signup sign-in login register my sites site help support status
    ].freeze

    SUBDOMAIN_PATTERN = /\A[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?\z/

    def new
      @resource = User.new
      render_registration
    end

    def create
      subdomain = params[:subdomain].to_s.strip.downcase
      errors = validate_subdomain(subdomain)

      existing = User.find_by(email: params[:email].to_s.strip.downcase)
      errors << "An account with that email already exists. Sign in instead." if existing

      if errors.any?
        @resource = User.new(email: params[:email], name: params[:name])
        return render_registration(alert: errors.join(" "))
      end

      site = build_site!(name: params[:site_name].presence || subdomain, subdomain: subdomain)
      site || return

      user = build_user!(site: site, name: params[:name], email: params[:email], password: params[:password])
      return unless user

      Multisite::UserSite.create!(user: user, site: site, role: "admin")

      sign_in(user)
      redirect_to onboarding_url(site), allow_other_host: true, notice: "Welcome to #{site.name}!"
    end

    # Signed-in users creating an additional site.
    def new_site
      @resource = nil
      render_registration(additional: true)
    end

    def create_site
      subdomain = params[:subdomain].to_s.strip.downcase
      errors = validate_subdomain(subdomain)

      if errors.any?
        @resource = nil
        return render_registration(additional: true, alert: errors.join(" "))
      end

      site = build_site!(name: params[:site_name].presence || subdomain, subdomain: subdomain)
      site || return

      Multisite::UserSite.create!(user: current_user, site: site, role: "admin")
      redirect_to onboarding_url(site), allow_other_host: true, notice: "Site \"#{site.name}\" created. Let's set it up."
    end

    private

    def redirect_signed_in_user_away_from_public_signup
      # Signed-in users create additional sites through /new-site, not /signup.
      redirect_to main_app.new_site_path
    end

    def render_registration(additional: false, status: nil, alert: nil)
      render(
        Multisite::RegistrationPage.new(
          resource: @resource,
          resource_name: :user,
          additional: additional,
          alert: alert || flash.now[:alert]
        ),
        status: status
      )
    end

    def validate_subdomain(subdomain)
      errors = []
      errors << "Please choose a subdomain." if subdomain.blank?
      unless subdomain.match?(SUBDOMAIN_PATTERN)
        errors << "Subdomain can only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens)."
      end
      if RESERVED_SUBDOMAINS.include?(subdomain)
        errors << "That subdomain is reserved."
      end
      if subdomain.present? && Site.where(subdomain: subdomain).or(Site.where(domain: "#{subdomain}.#{base_domain}")).exists?
        errors << "That subdomain is already taken."
      end
      errors
    rescue ActiveRecord::StatementInvalid, NoMethodError
      # pre-migration safety: fall back to domain-only uniqueness
      errors = [ "That subdomain is already taken." ] if subdomain.present? && Site.where(domain: "#{subdomain}.#{base_domain}").exists?
      errors
    end

    def build_site!(name:, subdomain:)
      site = Site.create!(
        name: name,
        domain: "#{subdomain}.#{base_domain}",
        subdomain: subdomain,
        active_theme: "default",
        plan: "free",
        active: true
      )
      # New sites inherit the platform's currently active plugins so per-site mode
      # starts from sensible defaults instead of nothing.
      Multisite::PluginGate.provision_default_activations!(site)
      site
    rescue ActiveRecord::RecordInvalid => e
      @resource = User.new(email: params[:email], name: params[:name])
      render_registration(status: :unprocessable_entity, alert: e.record.errors.full_messages.to_sentence)
      nil
    end

    def build_user!(site:, name:, email:, password:)
      owner_role = Role.find_or_create_by!(name: "site_owner") do |role|
        role.capabilities = %w[
          manage_site publish_posts edit_others_posts delete_posts
          edit_pages manage_menus moderate_comments upload_media
        ]
      end
      user = User.new(
        name: name,
        email: email.to_s.strip.downcase,
        password: password,
        site: site,
        role: owner_role
      )
      user.save!
      user
    rescue ActiveRecord::RecordInvalid => e
      # Site already created — give the owner access to it so they're not orphaned.
      user = User.find_by(email: email.to_s.strip.downcase)
      if user
        Multisite::UserSite.find_or_create_by!(user: user, site: site) { |us| us.role = "admin" }
        sign_in(user)
        redirect_to new_site_url(site), allow_other_host: true, notice: "Site created. You're already signed in, so we added it to your account."
      else
        @resource = e.record
        render_registration(status: :unprocessable_entity, alert: e.record.errors.full_messages.to_sentence)
      end
      nil
    end

    def base_domain
      Site.multisite_base_domain
    end

    def check_site_creation_enabled
      mode = Multisite::Settings.site_creation_mode
      return if mode == "open"

      message = mode == "invite_only" ? "Site creation is by invitation only." : "Site creation is currently closed."
      redirect_to main_app.root_path, alert: message
    end

    # Absolute URL for the newly created site's onboarding, so the redirect lands the user on
    # their own subdomain (where the resolver maps to their site).
    def onboarding_url(site)
      scheme = request.scheme
      port = request.port
      port_h = (port == 80 || port == 443) ? nil : ":#{port}"
      "#{scheme}://#{site.domain}#{port_h}/plugins/multisite/onboarding"
    end

    def new_site_url(site)
      scheme = request.scheme
      port = request.port
      port_h = (port == 80 || port == 443) ? nil : ":#{port}"
      "#{scheme}://#{site.domain}#{port_h}/admin"
    end
  end
end
