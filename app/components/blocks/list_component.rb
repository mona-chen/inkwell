module Blocks
  class ListComponent < ViewComponent::Base
    def initialize(data:)
      @ordered = data["ordered"] == true || data["ordered"] == "1"
      @items = data["items"].to_s.split("\n").reject(&:blank?)
    end

    def call
      return if @items.empty?

      content_tag(
        @ordered ? :ol : :ul,
        class: "content-list #{@ordered ? 'content-list--ordered' : 'content-list--unordered'}"
      ) do
        safe_join(@items.map { |item| content_tag(:li, item) })
      end
    end
  end
end
