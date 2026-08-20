module Blocks
  class ParagraphComponent < ViewComponent::Base
    def initialize(data:)
      @text = data["text"].to_s
    end

    def call
      content_tag(:p, @text, class: "text-base leading-relaxed text-gray-700 mb-4")
    end
  end
end
