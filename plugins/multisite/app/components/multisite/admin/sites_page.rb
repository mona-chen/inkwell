# frozen_string_literal: true

module Multisite
  module Admin
    class SitesPage < ApplicationComponent
      include Multisite::RouteHelpers

      def initialize(sites:, current_user:, site_creation_mode: "open")
        @sites = sites
        @current_user = current_user
        @site_creation_mode = site_creation_mode
      end

      def view_template
        render Toolbar.new do |toolbar|
          toolbar.leading do
            render ToolbarTitle.new(
              title: "Sites",
              subtitle: pluralize(@sites.size, "site")
            )
          end
          toolbar.trailing do
            render Button.new("New Site", href: multisite_routes.new_admin_site_path, variant: :primary, icon: :plus)
          end
        end

        render_policy_card

        if @sites.any?
          render Grid.new(cols: "1 sm:2 lg:3", gap: 4) do
            @sites.each do |site|
              render site_card(site)
            end
          end
        else
          render EmptyState.new(
            title: "No sites yet",
            description: "Create your first site to get started.",
            icon: :globe_2
          )
        end
      end

      private

      def render_policy_card
        Card.new do |card|
          card.body do
            div(class: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between") do
              div do
                p(class: "text-sm font-semibold text-foreground") { "Site creation" }
                p(class: "mt-0.5 text-xs text-muted-foreground") { "Who can create new sites from the public /signup page. You can always create sites here." }
              end
              form_with(url: multisite_routes.set_site_creation_mode_admin_sites_path, method: :post, class: "flex items-center gap-2") do |f|
                f.select :mode,
                  [ [ "Open", "open" ], [ "Invite only", "invite_only" ], [ "Closed", "closed" ] ],
                  { selected: @site_creation_mode },
                  class: "h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:border-ring focus:outline-none"
                f.submit "Save", class: "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              end
            end
          end
        end
      end

      def site_card(site)
        Card.new do |card|
          card.title do
            Flex(dir: :row, gap: 2, align: :center) do
              span(class: "flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground") do
                render Icon.new(:globe_2, size: :sm)
              end
              div(class: "min-w-0 flex-1") do
                div(class: "truncate text-base font-semibold text-foreground") { plain site.name }
                div(class: "truncate text-xs text-muted-foreground") { plain site.domain }
              end
            end
          end
          card.body do
            div(class: "flex flex-wrap gap-2 text-xs text-muted-foreground") do
              render Badge.new(site.active? ? "Active" : "Inactive", color: site.active? ? :success : :neutral, size: :xs)
              render Badge.new(site.plan.titleize, variant: :outline, size: :xs) if site.plan.present?
              render Badge.new("Default", color: :info, size: :xs) if site.is_default?
              span { plain "#{site.users.count} users" }
              span { plain "#{site.posts.count} posts" }
              span { plain "#{site.pages.count} pages" }
            end
          end
          card.footer do
            Flex(dir: :row, gap: 2) do
              render Button.new("Manage", href: multisite_routes.admin_site_users_path(site), variant: :ghost, size: :xs, icon: :users)
              render Button.new("Plugins", href: multisite_routes.admin_site_plugins_path(site), variant: :ghost, size: :xs, icon: :puzzle)
              render Button.new("Edit", href: multisite_routes.edit_admin_site_path(site), variant: :ghost, size: :xs, icon: :settings)

              if site.active? && !site.is_default?
                render ButtonTo.new(
                  "Deactivate",
                  href: multisite_routes.deactivate_admin_site_path(site),
                  method: :post,
                  variant: :ghost,
                  size: :xs
                )
              elsif !site.active?
                render ButtonTo.new(
                  "Activate",
                  href: multisite_routes.activate_admin_site_path(site),
                  method: :post,
                  variant: :primary,
                  size: :xs
                )
              end
            end
          end
        end
      end
    end
  end
end
