module Blocks
  class SeparatorComponent < ViewComponent::Base
    def initialize(data: {})
      @data = data
    end

    def call
      content_tag(:hr, nil, class: "border-gray-200 my-8")
    end
  end
end
