module Blocks
  class ImageComponent < ViewComponent::Base
    def initialize(data:)
      @url = data["url"]
      @alt = data["alt"].to_s
      @caption = data["caption"]
    end

    def render?
      @url.present?
    end
  end
end
