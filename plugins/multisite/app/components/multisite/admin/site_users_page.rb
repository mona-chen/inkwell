# frozen_string_literal: true

module Multisite
  module Admin
    class SiteUsersPage < ApplicationComponent
      include Multisite::RouteHelpers
      include Phlex::Rails::Helpers::ButtonTo

      def initialize(site:, user_sites:, invitations:)
        @site = site
        @user_sites = user_sites
        @invitations = invitations
      end

      def view_template
        render Toolbar.new do |toolbar|
          toolbar.leading do
            render ToolbarTitle.new(
              title: "Users — #{@site.name}",
              subtitle: pluralize(@user_sites.size, "user")
            )
          end
          toolbar.trailing do
            render Button.new("Back to Sites", href: multisite_routes.admin_sites_path, variant: :ghost, size: :sm)
          end
        end
        render Card.new do |card|
          card.title { "Add User" }
          card.body do
            form_with(url: multisite_routes.admin_site_users_path(@site), method: :post, class: "flex items-end gap-3") do |f|
              div(class: "flex-1 space-y-1") do
                f.label :email, "Email", class: "mb-1 block text-xs font-medium text-muted-foreground"
                f.email_field :email, class: input_class, placeholder: "user@example.com", required: true
              end
              div(class: "space-y-1") do
                f.label :role, "Role", class: "mb-1 block text-xs font-medium text-muted-foreground"
                f.select :role, Multisite::UserSite::ROLES.map(&:titleize), {}, class: input_class
              end
              f.submit "Add", class: "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
            end
          end
        end

        # Users table
        if @user_sites.any?
          render Card.new do |card|
            card.title { "Site Users" }
            card.body do
              render Table.new do |table|
                table.header_row do |row|
                  row.cell("User")
                  row.cell("Role")
                  row.cell("Joined")
                  row.cell("Actions")
                end
                @user_sites.each do |user_site|
                  table.row do |row|
                    row.cell do
                      Flex(dir: :row, gap: 2, align: :center) do
                        span(class: "text-sm font-medium text-foreground") { user_site.user.name }
                        span(class: "text-xs text-muted-foreground") { user_site.user.email }
                      end
                    end
                    row.cell do
                      render Badge.new(user_site.role.titleize, variant: :outline, size: :xs)
                    end
                    row.cell do
                      span(class: "text-xs text-muted-foreground") { user_site.created_at.strftime("%b %d, %Y") }
                    end
                    row.cell do
                      Flex(dir: :row, gap: 1) do
                        # Role change form
                        form_with(url: multisite_routes.admin_site_user_path(@site, user_site), method: :patch, class: "inline") do |f|
                          f.hidden_field :role, value: user_site.role == "admin" ? "editor" : "admin"
                          f.submit(user_site.role == "admin" ? "Demote" : "Promote", class: "text-xs text-primary hover:underline cursor-pointer bg-transparent border-0 p-0")
                        end
                        button_to(
                          "Remove",
                          multisite_routes.admin_site_user_path(@site, user_site),
                          method: :delete,
                          class: "text-xs text-destructive hover:underline",
                          form: { data: { turbo_confirm: "Remove this user from #{@site.name}?" } }
                        )
                      end
                    end
                  end
                end
              end
            end
          end
        end

        # Pending invitations
        if @invitations.any?
          render Card.new do |card|
            card.title { "Pending Invitations" }
            card.body do
              render Table.new do |table|
                table.header_row do |row|
                  row.cell("Email")
                  row.cell("Role")
                  row.cell("Sent")
                  row.cell("Expires")
                end
                @invitations.each do |invitation|
                  table.row do |row|
                    row.cell { span(class: "text-sm") { invitation.email } }
                    row.cell { render Badge.new(invitation.role.titleize, variant: :outline, size: :xs) }
                    row.cell { span(class: "text-xs text-muted-foreground") { invitation.created_at.strftime("%b %d, %Y") } }
                    row.cell { span(class: "text-xs text-muted-foreground") { invitation.expires_at.strftime("%b %d, %Y") } }
                  end
                end
              end
            end
          end
        end
      end

      private

      def input_class
        "h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
      end
    end
  end
end
