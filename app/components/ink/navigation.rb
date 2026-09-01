module Ink
  class Navigation < Component
    def initialize(groups:, brand_title: "Inkwell", brand_sub: "Studio", footer: nil)
      @groups = groups
      @brand_title = brand_title
      @brand_sub = brand_sub
      @footer = footer
    end

    def view_template
      div(class: "flex flex-col h-full bg-sidebar text-sidebar-foreground") do
        render_brand
        nav(class: "flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-3 pt-1", aria: { label: "Admin navigation" }) do
          @groups.each do |group|
            render_group(group)
          end
        end
        render_footer if @footer
      end
    end

    private

    def render_brand
      a(href: "/admin", class: "group flex items-center gap-2.5 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring") do
        span(class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-black/20 transition group-hover:-rotate-3 group-hover:scale-105") do
          render Ink::Icon.new(:pen_tool, size: :sm)
        end
        div do
          strong(class: "block text-base font-semibold leading-none tracking-[-0.03em] text-white") { @brand_title }
          span(class: "mt-1 block text-[9px] font-bold uppercase tracking-[0.22em] text-sidebar-foreground/40") { @brand_sub }
        end
      end
    end

    def render_group(group)
      div(class: "relative flex w-full min-w-0 flex-col py-1") do
        if group[:label]
          span(class: "flex h-7 shrink-0 items-center px-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/32") { group[:label] }
        end
        group[:items].each { |item| render_item(item) }
      end
    end

    def render_item(item)
      if item[:children]&.any?
        render_parent_item(item)
      else
        render_leaf_item(item)
      end
    end

    def render_parent_item(item)
      active = item[:current]
      div do
        a(
          href: item[:path],
          class: "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors #{active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/58 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}"
        ) do
          render Ink::Icon.new(item[:icon] || :circle, size: :sm)
          span(class: "flex-1 min-w-0 truncate") { item[:label] }
          render_badge(item[:badge]) if item[:badge]
          span(class: "ml-auto text-sidebar-foreground/40") { render Ink::Icon.new(:chevron_right, size: :xs) }
        end
        if item[:children]&.any?
          div(class: "ml-5 border-l border-sidebar-border pl-3 mt-0.5 mb-1 flex flex-col gap-0.5") do
            item[:children].each do |child|
              render_leaf_item(child)
            end
          end
        end
      end
    end

    def render_leaf_item(item)
      active = item[:current]
      a(
        href: item[:path],
        class: "group relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-xs transition-colors #{active ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm" : "text-sidebar-foreground/58 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"}",
        aria: active ? { current: "page" } : nil
      ) do
        span(class: "flex h-4 w-4 shrink-0 items-center justify-center #{active ? "text-primary" : "text-sidebar-foreground/38 group-hover:text-sidebar-accent-foreground/75"}") do
          render Ink::Icon.new(item[:icon] || :circle, size: :sm)
        end
        span(class: "flex-1 min-w-0 truncate") { item[:label] }
        render_badge(item[:badge]) if item[:badge]
      end
    end

    def render_badge(badge)
      span(class: "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/18 px-1.5 text-[10px] font-bold text-primary") { badge.to_s }
    end

    def render_footer
      div(class: "border-t border-sidebar-border px-4 py-4") { @footer.call }
    end
  end
end
