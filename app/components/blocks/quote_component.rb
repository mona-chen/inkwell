module Blocks
  class QuoteComponent < ViewComponent::Base
    def initialize(data:)
      @text = data["text"].to_s
      @attribution = data["attribution"]
    end

    def call
      safe_join([
        content_tag(:blockquote, @text, class: "border-l-4 border-indigo-500 pl-4 italic text-lg text-gray-800 my-6"),
        (content_tag(:cite, "— #{@attribution}", class: "block text-sm text-gray-500 mt-1") if @attribution.present?),
      ].compact)
    end
  end
end
