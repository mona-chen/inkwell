module Admin
  # The shell topbar: page title on the left, site + view-site + user actions on the right.
  class Topbar < ApplicationComponent
    def initialize(title:, user:, current_site: nil)
      @title = title
      @user = user
      @current_site = current_site
    end

    def view_template
      div(class: "admin-topbar-content flex items-center justify-between gap-4 w-full h-full", data: { controller: "appearance" }) do
        h1(class: "text-base font-semibold text-foreground truncate") { @title }

        div(class: "flex items-center gap-3 text-sm") do
          # Global Create button
          div(class: "relative", data: { controller: "dropdown" }) do
            button(
              type: "button",
              class: "inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover",
              data: { action: "click->dropdown#toggle" }
            ) do
              render Icon.new(:plus, size: :sm)
              span(class: "hidden sm:inline") { "Create" }
            end
            div(
              class: "hidden absolute right-0 z-50 mt-1 w-48 rounded-xl border border-border bg-elevated py-1 shadow-lg",
              data: { dropdown_target: "menu" }
            ) do
              a(href: new_admin_post_path, class: "flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors") do
                render Icon.new(:file_text, size: :sm)
                span { "New post" }
              end
              a(href: new_admin_page_path, class: "flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors") do
                render Icon.new(:layout, size: :sm)
                span { "New page" }
              end
              div(class: "border-t border-border my-1") {}
              a(href: admin_media_path, class: "flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors") do
                render Icon.new(:upload, size: :sm)
                span { "Upload media" }
              end
            end
          end

          # Dark mode toggle
          button(
            type: "button",
            class: "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            data: { action: "click->appearance#toggle" },
            aria: { label: "Toggle dark mode" }
          ) do
            render Icon.new(:sun, size: :sm)
          end

          a(
            href: "/",
            class: "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          ) do
            span(class: "hidden sm:inline") { "View site" }
            render Icon.new(:external_link, size: :sm)
          end

          div(class: "h-5 w-px bg-border") {}

          # Profile dropdown
          div(class: "relative", data: { controller: "dropdown" }) do
            button(
              type: "button",
              class: "flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted",
              data: { action: "click->dropdown#toggle" }
            ) do
              span(
                class: "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              ) do
                (@user&.name || "A").first.upcase
              end
              span(class: "hidden md:inline text-sm font-medium text-foreground") { @user&.name || "Admin" }
              render Icon.new(:chevron_down, size: :xs)
            end
            div(
              class: "hidden absolute right-0 z-50 mt-1 w-56 rounded-xl border border-border bg-background py-1 shadow-lg",
              data: { dropdown_target: "menu" }
            ) do
              div(class: "px-3 py-2 border-b border-border") do
                div(class: "text-sm font-medium text-foreground") { @user&.name || "Admin" }
                div(class: "text-xs text-muted-foreground") { @current_site&.name || "Inkwell" }
              end
              a(href: admin_settings_path, class: "flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors") do
                render Icon.new(:settings, size: :sm)
                span { "Settings" }
              end
              a(href: "/", class: "flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors") do
                render Icon.new(:external_link, size: :sm)
                span { "View site" }
              end
              div(class: "border-t border-border mt-1") {}
              a(href: "/users/sign_out", data: { turbo_method: :delete }, class: "flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors") do
                render Icon.new(:log_out, size: :sm)
                span { "Sign out" }
              end
            end
          end
        end
      end
    end
  end
end
