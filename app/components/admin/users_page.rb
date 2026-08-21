# frozen_string_literal: true

module Admin
  # User row management: every account on the site, with inline role editing and
  # deactivate/reactivate. New accounts are invited from the side card.
  class UsersPage < ApplicationComponent
    def initialize(users:, roles:, current_user:)
      @users = users
      @roles = roles
      @current_user = current_user
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(title: "Users", subtitle: "Manage who can sign in and what they can do")
        end
      end

      Grid(cols: "1 lg:3", gap: 6) do
        div(class: "lg:col-span-2") do
          render Card.new do |card|
            card.title { "Accounts" }
            card.body do
              if @users.empty?
                div(class: "py-8 text-center text-sm text-muted-foreground") { "No users yet — add your first account." }
              else
                ul(class: "divide-y divide-border") do
                  @users.each { |user| render_user_row(user) }
                end
              end
            end
          end
        end

        div(class: "lg:col-span-1") do
          render Card.new do |card|
            card.title { "Add user" }
            card.body do
              form_with(url: admin_users_path, method: :post, class: "space-y-3") do |f|
                div do
                  f.label :name, "Name", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.text_field :name, required: true, class: input_class, autofocus: true
                end
                div do
                  f.label :email, "Email", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.email_field :email, required: true, class: input_class
                end
                div do
                  f.label :password, "Password", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.password_field :password, required: true, class: input_class
                end
                div do
                  f.label :role_id, "Role", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.select :role_id, @roles.map { |r| [ r.name.titleize, r.id ] }, {}, class: input_class
                end
                f.submit "Add user", class: "w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
              end
            end
          end
        end
      end
    end

    private

    def input_class
      "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
    end

    def render_user_row(user)
      li(class: "py-3") do
        form_with(url: admin_user_path(user), method: :patch, class: "flex items-center gap-3") do |f|
          div(class: "min-w-0 flex-1") do
            div(class: "flex items-center gap-2") do
              span(class: "truncate text-sm font-medium text-foreground") { user.name }
              status_badge(user)
            end
            div(class: "truncate text-xs text-muted-foreground") do
              "#{user.email} · #{user.posts.count} posts · joined #{user.created_at.strftime("%b %Y")}"
            end
          end

          f.select :role_id,
            @roles.map { |r| [ r.name.titleize, r.id ] },
            { selected: user.role_id },
            class: "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-ring focus:outline-none"

          f.submit "Save", class: "rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"

          if user.deactivated?
            render ButtonTo.new("Reactivate", href: reactivate_admin_user_path(user), method: :post, variant: :ghost, size: :xs)
          else
            render ButtonTo.new("Deactivate", href: deactivate_admin_user_path(user), method: :post, variant: :ghost, size: :xs,
              data: { turbo_confirm: "Deactivate #{user.name}? They won't be able to sign in." })
          end

          unless user == @current_user
            render ButtonTo.new("Delete", href: admin_user_path(user), method: :delete, variant: :ghost, size: :xs,
              data: { turbo_confirm: "Permanently delete #{user.name}? Their posts keep their content." })
          end
        end
      end
    end

    def status_badge(user)
      if user.deactivated?
        span(class: "rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive") { "Deactivated" }
      else
        span(class: "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700") { "Active" }
      end
    end
  end
end
