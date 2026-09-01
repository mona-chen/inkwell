module Ink
  class CommandPalette < Component
    def initialize(id: "command-palette", label: "Search", placeholder: "Search…")
      @id = id
      @label = label
      @placeholder = placeholder
      @destinations = []
    end

    def destination(label, href:, description: nil)
      @destinations << { label: label, href: href, description: description }
    end

    def view_template
      yield self if block_given?

      div(
        id: @id,
        class: "min-w-0 flex-1",
        data: { controller: "command-palette", action: "keydown@window->command-palette#shortcut" }
      ) do
        render_trigger
        render_dialog
      end
    end

    private

    def render_trigger
      button(
        type: "button",
        class: "group flex h-9 w-full max-w-lg items-center gap-2.5 rounded-xl border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-sm transition hover:border-primary/25 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        data: { command_palette_target: "trigger", action: "click->command-palette#open" }
      ) do
        render Ink::Icon.new(:search, size: :sm)
        span(class: "min-w-0 flex-1 truncate") { @placeholder }
        kbd(class: "hidden rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground sm:inline") { "⌘K" }
      end
    end

    def render_dialog
      div(
        class: "fixed inset-0 z-[100] hidden px-4 pt-[12vh]",
        data: {
          command_palette_target: "panel",
          action: "click->command-palette#outsideClick"
        }
      ) do
        div(class: "absolute inset-0 bg-slate-950/45 backdrop-blur-sm", data: { action: "click->command-palette#close" })
        div(class: "relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-black/20", role: "dialog", aria: { label: @label, modal: "true" }) do
          render_search_input
          render_results
        end
      end
    end

    def render_search_input
      div(class: "flex items-center gap-3 border-b border-border px-4") do
        render Ink::Icon.new(:search, size: :sm)
        input(
          type: "text",
          class: "h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground",
          placeholder: @placeholder,
          autocomplete: "off",
          data: {
            command_palette_target: "input",
            action: "input->command-palette#filter keydown->command-palette#navigate"
          }
        )
      end
    end

    def render_results
      div(class: "max-h-[24rem] overflow-y-auto p-2", data: { command_palette_target: "results" }) do
        if @destinations.any?
          @destinations.each do |dest|
            a(
              href: dest[:href],
              class: "group flex items-center rounded-xl px-3 py-2.5 outline-none transition hover:bg-accent focus:bg-accent",
              data: { command_palette_target: "destination", action: "click->command-palette#select" }
            ) do
              div(class: "min-w-0") do
                span(class: "block text-sm font-semibold") { dest[:label] }
                if dest[:description]
                  span(class: "mt-0.5 block truncate text-xs text-muted-foreground") { dest[:description] }
                end
              end
            end
          end
          div(class: "ink-command-empty hidden px-3 py-8 text-center text-sm text-muted-foreground") { "No matching destinations" }
        else
          div(class: "ink-command-empty px-3 py-8 text-center text-sm text-muted-foreground") { "No matching destinations" }
        end
      end
    end
  end
end
