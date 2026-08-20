module Blocks
  class ListComponent < ViewComponent::Base
    def initialize(data:)
      @ordered = data["ordered"] == true || data["ordered"] == "1"
      @items = data["items"].to_s.split("\n").reject(&:blank?)
    end

    def call
      return if @items.empty?

      content_tag(@ordered ? :ol : :ul, class: "list-inside mb-4 space-y-1") do
        @items.map { |item| content_tag(:li, item, class: "list-disc") }.join.html_safe
      end
    end
  end
end
