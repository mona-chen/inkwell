module Ink
  class Button < Component
    VARIANT_CLASSES = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      default: "border border-border bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
      ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      danger: "bg-destructive text-white hover:bg-destructive/90",
      destructive: "bg-destructive text-white hover:bg-destructive/90",
      outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground"
    }.freeze

    SIZE_CLASSES = {
      xs: "h-6 px-2 text-[11px] gap-1",
      sm: "h-8 px-2.5 text-xs gap-1.5",
      md: "h-9 px-3 text-[13px] gap-1.5",
      lg: "h-10 px-4 text-sm gap-2"
    }.freeze

    def initialize(text = nil, href: nil, variant: :secondary, size: :md, icon: nil, type: nil, form: nil, **html)
      @text = text
      @href = href
      @variant = variant
      @size = size
      @icon = icon
      @type = type
      @form = form
      @html = html
    end

    def view_template(&block)
      classes = "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold tracking-[-0.01em] whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 #{VARIANT_CLASSES[@variant] || VARIANT_CLASSES[:secondary]} #{SIZE_CLASSES[@size] || SIZE_CLASSES[:md]}"

      if @href
        a(href: @href, class: classes, **@html) { content(&block) }
      else
        button(type: @type || "button", class: classes, form: @form, **@html) { content(&block) }
      end
    end

    private

    def content(&block)
      render Ink::Icon.new(@icon, size: @size == :xs ? :xs : :sm) if @icon
      span { @text } if @text
      yield if block
    end
  end
end
