# frozen_string_literal: true

module Multisite
  module Admin
    class SiteFormPage < ApplicationComponent
      include Multisite::RouteHelpers
      include Phlex::Rails::Helpers::TextFieldTag
      include Phlex::Rails::Helpers::ButtonTo
      include Phlex::Rails::Helpers::ButtonTag

      def initialize(site:, errors: nil, server_ip: nil)
        @site = site
        @errors = errors
        @editing = site.persisted?
        @server_ip = server_ip || Site.multisite_base_domain
      end

      def view_template
        div(class: "mx-auto max-w-[840px] px-4 py-6") do
          render_breadcrumbs
          render_header
          render_divider

          form_with(model: @site, url: form_url, method: form_method, data: { controller: "site-form", action: "input->site-form#markDirty change->site-form#markDirty" }) do |f|
            render_error_messages if @errors&.any?
            render_general_section(f)
            render_domains_section(f)
            render_appearance_section(f)
            render_plan_section
            render_advanced_section(f)

            render_divider
            render_actions(f)
          end
        end

        render_sticky_save
      end

      private

      # --- Breadcrumbs ---

      def render_breadcrumbs
        nav(class: "mb-4 flex items-center gap-1.5 text-sm text-foreground/60") do
          a(href: multisite_routes.admin_sites_path, class: "hover:text-foreground transition-colors") { "Sites" }
          plain " / "
          span(class: "text-foreground font-medium") { @editing ? @site.name : "New site" }
        end
      end

      # --- Header ---

      def render_header
        div(class: "mb-6") do
          div(class: "flex items-center justify-between") do
            div(class: "flex items-center gap-3") do
              h1(class: "text-2xl font-bold text-foreground") { @editing ? @site.name : "New site" }
              if @editing
                badge_class = @site.active? ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"
                span(class: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium #{badge_class}") { @site.active? ? "Active" : "Inactive" }
              end
            end
            if @editing
              a(href: "http://#{@site.domain}", target: "_blank", class: "text-sm text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1") do
                plain "Visit site"
                render Icon.new(:external_link, size: :xs)
              end
            end
          end
          if @editing
            p(class: "mt-1 text-sm text-foreground/60") do
              plain @site.domain
              plain " · "
              plain @site.plan.titleize
              plain " · "
              plain "#{@site.users.count} #{(@site.users.count == 1) ? "user" : "users"}"
            end
          else
            p(class: "mt-1 text-sm text-foreground/60") { "Create a new site in your network." }
          end
        end
      end

      # --- General ---

      def render_general_section(f)
        render_section("General", "Basic information about this site.") do
          div(class: "space-y-4") do
            div(class: "space-y-1.5") do
              f.label :name, class: "block text-sm font-medium text-foreground" do
                plain "Site name"
                span(class: "text-destructive ml-0.5") { "*" }
              end
              f.text_field :name, class: input_class, placeholder: "My Blog", required: true
            end

            div(class: "space-y-1.5") do
              p(class: "block text-sm font-medium text-foreground") { "Site logo" }
              div(class: "flex items-center justify-between rounded-lg border border-border px-4 py-3") do
                div(class: "flex items-center gap-3") do
                  if @editing && @site.logo_item
                    div(class: "h-8 w-8 rounded border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0") do
                      img(src: @site.logo_item.file.attached? ? url_for(@site.logo_item.file) : "", class: "h-full w-full object-contain", alt: "Logo")
                    end
                    span(class: "text-sm text-foreground") { @site.logo_item.filename.to_s }
                  else
                    span(class: "text-sm text-foreground/60") { "No logo set" }
                  end
                end
                span(class: "text-xs text-foreground/50") { "Managed by site admin" }
              end
            end
          end
        end
      end

      # --- Domains ---

      def render_domains_section(f)
        render_section("Domains", "Addresses that point to this site.") do
          div(class: "space-y-2") do
            render_domain_row(@site.domain, "Primary", status: "active", removable: false)

            if @site.subdomain.present?
              render_domain_row("#{@site.subdomain}.#{base_domain}", "Inkwell", status: "active", removable: false)
            end

            @site.custom_domains.each do |cd|
              render_custom_domain_row(cd)
            end

            div(class: "mt-4", data: { controller: "toggle" }) do
              button_tag(
                type: "button",
                class: "text-sm text-primary hover:text-primary/80 font-medium transition-colors inline-flex items-center gap-1",
                data: { action: "click->toggle#toggle" }
              ) do
                plain "+ Add domain"
              end
              div(class: "hidden mt-3", data: { toggle_target: "menu" }) do
                text_field_tag :custom_domain, nil, id: "custom_domain", placeholder: "example.com", class: "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                p(class: "mt-1.5 text-xs text-foreground/50") { "You'll configure DNS after adding the domain." }
              end
            end
          end
        end
      end

      def render_domain_row(domain, label, status: "active", removable: false, domain_id: nil)
        status_config = domain_status(status)

        div(class: "flex items-center justify-between rounded-lg border border-border px-3 py-2.5") do
          div(class: "flex items-center gap-3 min-w-0") do
            span(class: "text-sm font-mono text-foreground truncate") { domain }
            span(class: "shrink-0 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/60") { label }
          end
          div(class: "flex items-center gap-3 shrink-0") do
            div(class: "flex items-center gap-1.5") do
              span(class: "h-2 w-2 rounded-full #{status_config[:dot]}")
              span(class: "text-xs #{status_config[:text_class]}") { status_config[:text] }
            end
            if removable && domain_id
              button_to(
                multisite_routes.remove_domain_admin_site_path(@site, domain_id: domain_id),
                method: :delete,
                class: "text-xs text-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100",
                data: { turbo_confirm: "Remove #{domain}?" }
              ) { "Remove" }
            end
          end
        end
      end

      def render_custom_domain_row(domain_record)
        status_config = domain_status(domain_record.status)
        actionable = %w[setup_required dns_incorrect error].include?(domain_record.status)
        is_expanded = false # Toggle controller handles this

        div(class: "space-y-2", data: { controller: "toggle" }) do
          button_tag(
            type: "button",
            class: "w-full flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left hover:bg-muted/50 transition-colors",
            data: { action: "click->toggle#toggle" }
          ) do
            div(class: "flex items-center gap-3 min-w-0") do
              span(class: "text-sm font-mono text-foreground truncate") { domain_record.domain }
              span(class: "shrink-0 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/60") { "Custom" }
            end
            div(class: "flex items-center gap-3 shrink-0") do
              div(class: "flex items-center gap-1.5") do
                span(class: "h-2 w-2 rounded-full #{status_config[:dot]}")
                span(class: "text-xs #{status_config[:text_class]}") { status_config[:text] }
              end
              if actionable
                span(class: "text-xs text-primary") { "Configure" }
              end
              svg(class: "h-4 w-4 text-foreground/40", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 20 20", fill: "currentColor") do |s|
                s.path(fill_rule: "evenodd", d: "M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z", clip_rule: "evenodd")
              end
            end
          end

          div(class: "hidden", data: { toggle_target: "menu" }) do
            render_domain_panel(domain_record)
          end
        end
      end

      def render_domain_panel(domain_record)
        status = domain_record.status

        div(class: "rounded-lg border border-border bg-card p-4 space-y-4") do
          case status
          when "setup_required", "dns_incorrect"
            div do
              p(class: "text-sm font-semibold text-foreground") { "Connect #{domain_record.domain}" }
              p(class: "text-xs text-foreground/50 mt-1") do
                plain "Sign in to the provider that manages DNS for "
                span(class: "font-medium text-foreground/70") { domain_record.domain }
                plain " (such as Cloudflare, GoDaddy, or Namecheap), then add the record below."
              end
            end

            div(class: "rounded-lg border border-border bg-muted/30 p-3 space-y-2") do
              div(class: "flex items-center gap-2") do
                div(class: "flex-1") do
                  p(class: "text-[11px] font-medium text-foreground/50 uppercase tracking-wide") { "Type" }
                  p(class: "text-sm font-mono text-foreground") { "A" }
                end
                div(class: "flex-1") do
                  p(class: "text-[11px] font-medium text-foreground/50 uppercase tracking-wide") { "Name" }
                  p(class: "text-sm font-mono text-foreground") { "@" }
                end
                div(class: "flex-[2]") do
                  p(class: "text-[11px] font-medium text-foreground/50 uppercase tracking-wide") { "Value" }
                  div(class: "flex items-center gap-2") do
                    p(class: "text-sm font-mono text-foreground") { @server_ip }
                    button_tag(
                      type: "button",
                      class: "text-xs text-primary hover:text-primary/80 transition-colors",
                      data: { action: "click->clipboard#copy", clipboard_value: @server_ip }
                    ) { "Copy" }
                  end
                end
              end
            end

            if status == "dns_incorrect" && domain_record.error_message.present?
              div(class: "rounded-lg border border-amber-500/30 bg-amber-500/10 p-3") do
                p(class: "text-xs text-amber-500") { domain_record.error_message }
              end
            end

            p(class: "text-xs text-foreground/50") { "DNS changes can take a few minutes to propagate. In some cases, they may take longer." }

            div(class: "flex items-center justify-between") do
              button_to(
                multisite_routes.check_domain_admin_site_path(@site, domain_id: domain_record.id),
                method: :post,
                class: "inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              ) { "Check connection" }
              button_to(
                multisite_routes.remove_domain_admin_site_path(@site, domain_id: domain_record.id),
                method: :delete,
                class: "text-xs text-foreground/60 hover:text-destructive transition-colors",
                data: { turbo_confirm: "Remove #{domain_record.domain}?\n\nVisitors using this domain will no longer reach #{@site.name}. Your DNS records won't be changed." }
              ) { "Remove domain" }
            end

          when "active"
            div(class: "flex items-center justify-between") do
              div do
                p(class: "text-sm font-semibold text-foreground") { domain_record.domain }
                p(class: "text-xs text-emerald-500") { "Connected and verified" }
              end
              div(class: "flex items-center gap-3") do
                unless domain_record.site.primary_domain == domain_record.domain
                  button_to(
                    multisite_routes.make_primary_admin_site_path(@site, domain_id: domain_record.id),
                    method: :post,
                    class: "text-xs text-primary hover:text-primary/80 transition-colors"
                  ) { "Make primary" }
                end
                button_to(
                  multisite_routes.remove_domain_admin_site_path(@site, domain_id: domain_record.id),
                  method: :delete,
                  class: "text-xs text-foreground/60 hover:text-destructive transition-colors",
                  data: { turbo_confirm: "Remove #{domain_record.domain}?\n\nVisitors using this domain will no longer reach #{@site.name}. Your DNS records won't be changed." }
                ) { "Remove" }
              end
            end

          when "verifying"
            div(class: "flex items-center gap-3") do
              div(class: "h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin")
              div do
                p(class: "text-sm font-semibold text-foreground") { "Verifying connection" }
                p(class: "text-xs text-foreground/50") { "DNS looks correct. Verifying domain ownership." }
              end
            end

          when "ssl_provisioning"
            div(class: "space-y-2") do
              p(class: "text-sm font-semibold text-foreground") { "Securing domain" }
              p(class: "text-xs text-foreground/50") { "DNS is connected. We're issuing an SSL certificate for #{domain_record.domain}. This usually takes a few minutes." }
              div(class: "flex items-center gap-4 text-xs") do
                div(class: "flex items-center gap-1.5") do
                  span(class: "text-emerald-500") { "✓" }
                  span(class: "text-foreground/70") { "DNS verified" }
                end
                div(class: "flex items-center gap-1.5") do
                  span(class: "text-primary") { "◌" }
                  span(class: "text-foreground/70") { "SSL certificate" }
                end
              end
            end

          when "error"
            div do
              p(class: "text-sm font-semibold text-foreground") { "Verification failed" }
              p(class: "text-xs text-foreground/50 mt-1") { domain_record.error_message || "An error occurred during verification." }
            end

            div(class: "flex items-center justify-between") do
              button_to(
                multisite_routes.check_domain_admin_site_path(@site, domain_id: domain_record.id),
                method: :post,
                class: "inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              ) { "Try again" }
              button_to(
                multisite_routes.remove_domain_admin_site_path(@site, domain_id: domain_record.id),
                method: :delete,
                class: "text-xs text-foreground/60 hover:text-destructive transition-colors",
                data: { turbo_confirm: "Remove #{domain_record.domain}?\n\nVisitors using this domain will no longer reach #{@site.name}. Your DNS records won't be changed." }
              ) { "Remove domain" }
            end

          else
            div do
              p(class: "text-sm font-semibold text-foreground") { domain_record.domain }
              p(class: "text-xs text-foreground/50") { "Status: #{status}" }
            end
          end
        end
      end

      def domain_status(status)
        case status
        when "active"
          { dot: "bg-emerald-500", text: "Active", text_class: "text-emerald-600" }
        when "setup_required"
          { dot: "bg-amber-500", text: "Setup required", text_class: "text-amber-600" }
        when "checking_dns"
          { dot: "bg-blue-500", text: "Checking DNS", text_class: "text-blue-600" }
        when "dns_incorrect"
          { dot: "bg-destructive", text: "DNS incorrect", text_class: "text-destructive" }
        when "verifying"
          { dot: "bg-blue-500", text: "Verifying", text_class: "text-blue-600" }
        when "ssl_provisioning"
          { dot: "bg-blue-500", text: "SSL setup", text_class: "text-blue-600" }
        when "error"
          { dot: "bg-destructive", text: "Error", text_class: "text-destructive" }
        else
          { dot: "bg-muted-foreground", text: "Unknown", text_class: "text-foreground/50" }
        end
      end

      # --- Appearance ---

      def render_appearance_section(_f)
        render_section("Appearance", "The site's active design.") do
          div(class: "flex items-center justify-between rounded-lg border border-border px-4 py-3") do
            div(class: "min-w-0 flex-1") do
              p(class: "text-sm font-medium text-foreground") { theme_label(@site.active_theme) }
              p(class: "text-xs text-foreground/50") { "Active theme" }
            end
            span(class: "text-xs text-foreground/50") { "Managed by site admin in Appearance" }
          end
        end
      end

      def theme_label(slug)
        theme = Theme.discover.find { |t| t[:slug] == slug }
        theme&.dig(:name) || slug.to_s.titleize
      end

      # --- Plan ---

      def render_plan_section
        render_section("Plan", "Usage and features available to this site.") do
          div(class: "flex items-center justify-between rounded-lg border border-border px-4 py-3") do
            div do
              p(class: "text-sm font-semibold text-foreground") { @site.plan.titleize }
              p(class: "text-xs text-foreground/50") {
                case @site.plan
                when "free" then "1 user · Basic features for personal sites"
                when "pro" then "Up to 10 users · Advanced features"
                when "business" then "Unlimited users · Full feature set"
                when "enterprise" then "Custom limits · Priority support"
                else "Current plan"
                end
              }
            end
            span(class: "text-xs text-foreground/50") { "Managed by network admin" }
          end
        end
      end

      # --- Advanced ---

      def render_advanced_section(f)
        render_section("Advanced", "Network-level configuration.") do
          if @editing
            div(class: "flex items-center justify-between rounded-lg border border-border px-4 py-3") do
              div(class: "min-w-0 flex-1") do
                p(class: "text-sm font-medium text-foreground") { "Default site" }
                p(class: "text-xs text-foreground/50") { "Serve this site when no configured domain matches a request." }
              end
              div(class: "shrink-0 ml-4") do
                f.check_box :is_default, class: "sr-only peer", id: "site_default_toggle"
                label(for: "site_default_toggle", class: "relative inline-flex h-6 w-11 cursor-pointer rounded-full border border-border bg-muted transition-colors peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-ring/20") do
                  span(class: "pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground shadow-sm transition-transform peer-checked:translate-x-5")
                end
              end
            end
          else
            p(class: "text-sm text-foreground/50") { "Advanced options are available after creating the site." }
          end
        end
      end

      # --- Actions ---

      def render_actions(f)
        div(class: "flex items-center justify-end gap-3 py-4") do
          a(href: multisite_routes.admin_sites_path, class: "inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors") { "Cancel" }
          f.submit(@editing ? "Save changes" : "Create site", class: "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors")
        end
      end

      def render_sticky_save
        return unless @editing

        div(class: "fixed bottom-0 left-0 right-0 z-50 hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", data: { site_form_target: "bar" }) do
          div(class: "mx-auto max-w-[840px] flex items-center justify-between px-4 py-3") do
            span(class: "text-sm text-foreground/70") { "Unsaved changes" }
            div(class: "flex items-center gap-3") do
              button_tag(
                type: "button",
                class: "text-sm text-foreground/60 hover:text-foreground transition-colors",
                data: { action: "click->site-form#discard" }
              ) { "Discard" }
              button_tag(
                type: "submit",
                form: "site-form",
                class: "inline-flex h-8 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              ) { "Save changes" }
            end
          end
        end
      end

      # --- Shared ---

      def render_section(title, description = nil, &block)
        div(class: "mb-12") do
          div(class: "mb-4") do
            h2(class: "text-sm font-semibold text-foreground") { title }
            p(class: "text-xs text-foreground/50 mt-0.5") { description } if description
          end
          yield
        end
      end

      def render_divider
        div(class: "border-t border-border my-2")
      end

      def render_error_messages
        div(class: "mb-6") do
          render Ink::Alert.new(variant: :error, title: "Unable to save site") do
            @errors.full_messages.each { |msg| p msg }
          end
        end
      end

      def input_class
        "h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
      end

      def base_domain
        Site.multisite_base_domain
      end

      def form_url
        @editing ? multisite_routes.admin_site_path(@site) : multisite_routes.admin_sites_path
      end

      def form_method
        @editing ? :patch : :post
      end
    end
  end
end
