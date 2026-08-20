module Blocks
  class ButtonComponent < ViewComponent::Base
    def initialize(data:)
      @label = data["label"].to_s
      @url = data["url"].to_s
      @primary = data["style"] != "secondary"
    end

    def call
      return if @label.blank? || @url.blank?

      link_to @label, @url, class: "inline-block rounded-lg px-6 py-3 text-sm font-medium transition-colors #{button_classes}"
    end

    private

    def button_classes
      @primary ? "bg-gray-900 text-white hover:bg-black" : "border border-gray-300 text-gray-900 hover:bg-gray-50"
    end
  end
end
