module Ink
  class Shell < Component
    def initialize
      @navigation = nil
      @topbar = nil
      @main = nil
    end

    def navigation(&block) = (@navigation = block)
    def topbar(&block) = (@topbar = block)
    def main(&block) = (@main = block)

    def view_template
      yield self if block_given?

      div(
        id: "admin-shell",
        class: "flex min-h-svh bg-background text-foreground",
        data: { ink: "shell", controller: "admin-shell", action: "keydown.esc@window->admin-shell#close" }
      ) do
        button(
          type: "button",
          class: "fixed inset-0 z-40 hidden bg-slate-950/55 backdrop-blur-[2px] lg:hidden",
          data: { admin_shell_target: "overlay", action: "click->admin-shell#close" },
          aria: { label: "Close navigation" }
        )
        aside(
          id: "admin-navigation",
          class: "fixed inset-y-0 left-0 z-50 flex w-[15.5rem] -translate-x-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 lg:shadow-none",
          data: { admin_shell_target: "panel" }
        ) do
          button(
            type: "button",
            class: "absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/55 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden",
            data: { action: "click->admin-shell#close" },
            aria: { label: "Close navigation" }
          ) { render Ink::Icon.new(:x, size: :sm) }
          render_slot(@navigation)
        end
        div(class: "flex min-w-0 flex-1 flex-col") do
          header(class: "sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/85 backdrop-blur-xl") do
            div(class: "flex w-full items-center gap-3 px-4 sm:px-6 lg:px-8") do
              button(
                type: "button",
                class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground lg:hidden",
                data: { action: "click->admin-shell#open" },
                aria: { label: "Open navigation", controls: "admin-navigation", expanded: "false" }
              ) { render Ink::Icon.new(:menu, size: :sm) }
              render_slot(@topbar)
            end
          end
          div(class: "min-w-0 flex-1") do
            div(class: "w-full px-4 py-4 sm:px-6 sm:py-5 lg:px-7 lg:py-6") do
              render_slot(@main)
            end
          end
        end
      end
    end

    private

    def render_slot(block)
      return unless block
      block.call
    end
  end
end
