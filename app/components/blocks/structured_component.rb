module Blocks
  # Rails-theme renderer for the structured blocks (table, FAQ, takeaways, stats, …). It
  # delegates to ThemeRuntime::ContentHtml so static themes and Rails themes share exactly
  # one escaped, allow-listed markup per block. `Blocks::StructuredComponent.for("table")`
  # returns a component class bound to that block type for BlockRenderer::REGISTRY.
  class StructuredComponent < ViewComponent::Base
    class_attribute :block_type

    def self.for(type)
      @types ||= {}
      @types[type.to_s] ||= Class.new(self) do
        self.block_type = type.to_s
        def self.name = "Blocks::StructuredComponent[#{block_type}]"
      end
    end

    def initialize(data:)
      @data = data || {}
    end

    def call
      ThemeRuntime::ContentHtml.render([ { "type" => block_type, "data" => @data } ]).html_safe
    end
  end
end
