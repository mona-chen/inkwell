module Blocks
  class HeadingComponent < ViewComponent::Base
    def initialize(data:)
      @level = (data["level"] || 2).to_i.clamp(1, 6)
      @text = data["text"].to_s
    end

    def call
      content_tag("h#{@level}", @text, class: heading_classes)
    end

    private

    def heading_classes
      {
        1 => "text-4xl font-bold tracking-tight mb-6",
        2 => "text-3xl font-bold tracking-tight mb-5",
        3 => "text-2xl font-semibold mb-4",
        4 => "text-xl font-semibold mb-3",
        5 => "text-lg font-semibold mb-2",
        6 => "text-base font-semibold mb-2",
      }[@level]
    end
  end
end
