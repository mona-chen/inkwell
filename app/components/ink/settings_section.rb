module Ink
  class SettingsSection < Component
    def initialize(title:, description: nil, id: nil, **html, &block)
      @title = title
      @description = description
      @id = id
      @html = html
      @form = nil
      @block = block
    end

    def form(&block) = (@form = block)

    def view_template(&block)
      (@block || block)&.call(self)
      section(id: @id, class: "mb-3 overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs", **@html) do
        div(class: "border-b border-border/70 px-4 py-3") do
          h2(class: "text-sm font-semibold") { @title }
          p(class: "mt-0.5 text-xs text-muted-foreground") { @description } if @description
        end
        div(class: "px-4 py-4") { @form&.call }
      end
    end
  end
end
