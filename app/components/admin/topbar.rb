module Admin
  # The shell topbar: page title on the left, site + view-site + user actions on the right.
  class Topbar < ApplicationComponent
    def initialize(title:, user:, current_site: nil)
      @title = title
      @user = user
      @current_site = current_site
    end

    def view_template
      div(class: "flex items-center justify-between gap-4 w-full h-full") do
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
