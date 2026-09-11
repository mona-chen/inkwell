module Multisite
  # Rack middleware that resolves the current site from the incoming request.
  #
  # Resolution order:
  #   1. Session override (admin switching sites via the site switcher)
  #   2. Exact domain match (sites.domain = request.host or host_with_port)
  #   3. Subdomain match (tenant + INKWELL_BASE_DOMAIN)
  #   4. Default site flag (sites.default = true)
  #   5. First active site (single-site fallback)
  #
  # The resolved site is set on Current.site and its id is stored in the rack
  # env so ApplicationController can settle on the same site without re-resolving.
  # Current.site is reset when the request completes (like a per-request thread-local).
  class SiteResolver
    RACK_SITE_ID_KEY = "multisite.site_id"
    RACK_SITE_DOMAIN_KEY = "multisite.site_domain"

    def initialize(app)
      @app = app
    end

    def call(env)
      request = ActionDispatch::Request.new(env)
      site = resolve_site(request)

      if site
        Current.site = site
        env[RACK_SITE_ID_KEY] = site.id
      end

      @app.call(env)
    ensure
      Current.reset
    end

    private

    def resolve_site(request)
      # 1. Admin session switch — the site switcher stores the target id in the session.
      #    Only honor it when the request domain matches the stored domain to prevent
      #    cross-domain data leaks.
      if (site_id = request.session[RACK_SITE_ID_KEY].presence && request.session[RACK_SITE_ID_KEY])
        stored_domain = request.session[RACK_SITE_DOMAIN_KEY]
        if stored_domain.nil? || stored_domain == request.host || stored_domain == request.host_with_port
          site = active_sites.find_by(id: site_id)
          return site if site
        end
      end

      # 2. Exact domain match. host_with_port covers `localhost:3000` style records from seeds;
      # a clean `host` match is tried first so port-less production records win.
      host = request.host
      if (site = active_sites.find_by(domain: host))
        return site
      end
      if host_with_port = request.host_with_port
        if (site = active_sites.find_by(domain: host_with_port))
          return site
        end
      end

      # 3. Custom domain match — sites can have additional domains beyond their primary one.
      begin
        if (custom = Multisite::SiteCustomDomain.find_by(domain: host))
          return custom.site if custom.site&.active?
        end
        if host_with_port && host_with_port != host
          if (custom = Multisite::SiteCustomDomain.find_by(domain: host_with_port))
            return custom.site if custom.site&.active?
          end
        end
      rescue ActiveRecord::TableNotFound, ActiveRecord::StatementInvalid
        # Table doesn't exist yet (pre-migration) — skip custom domain check.
      end

      # 4. Subdomain match — tenant.<base_domain> (also covers the stored full subdomain
      #    domain since step 2 would have matched it).
      if base_domain && host.end_with?(".#{base_domain}")
        subdomain = host.sub(".#{base_domain}", "")
        if subdomain.present? && (site = active_sites.find_by(subdomain: subdomain))
          return site
        end
      end

      # 4. The configured default site (usually the platform itself).
      if (site = active_sites.find_by(is_default: true))
        return site
      end

      # 5. First site — preserves the original single-site behavior. Prevents 500s
      #    when Current.site is nil in single-site or development deployments.
      active_sites.order(:id).first
    end

    def active_sites
      Site.where(active: true)
    rescue ActiveRecord::StatementInvalid, NoMethodError
      # The `active` column exists only after the multisite migration; fall back to all sites.
      Site.all
    end

    def base_domain
      Site.multisite_base_domain
    end
  end
end
