module Admin
  # The shell topbar: page title on the left, site + view-site + user actions on the right.
  class Topbar < ApplicationComponent
    def initialize(title:, user:, current_site: nil)
      @title = title
      @user = user
      @current_site = current_site
    end

    def view_template
      div(class: "admin-topbar-content flex items-center justify-between gap-4 w-full h-full") do
        h1(class: "text-base font-semibold text-foreground truncate") { @title }

        div(class: "flex items-center gap-3 text-sm") do
          if @current_site
            span(
              class: "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            ) do
              render Icon.new(:globe, size: :sm)
              span { @current_site.name }
            end
          end
          # Global Create button (replaces Quick Actions section)
          div(class: "relative", data: { controller: "dropdown" }) do
            button(
              type: "button",
              class: "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover",
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
                render Icon.new(:file, size: :sm)
                span { "New page" }
              end
              a(href: admin_media_path, class: "flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors") do
                render Icon.new(:upload, size: :sm)
                span { "Upload media" }
              end
            end
          end
          a(
            href: "/",
            class: "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          ) do
            span(class: "hidden sm:inline") { "View site" }
            render Icon.new(:external_link, size: :sm)
          end
          div(class: "h-5 w-px bg-border") {}
          div(class: "flex items-center gap-2") do
            span(
              class: "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            ) do
              (@user&.name || "A").first.upcase
            end
            span(class: "hidden md:inline text-sm font-medium text-foreground") { @user&.name || "Admin" }
          end
        end
      end
    end
  end
end
