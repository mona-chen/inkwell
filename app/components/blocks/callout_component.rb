module Blocks
  class CalloutComponent < ViewComponent::Base
    TONES = {
      "info"    => "border-indigo-200 bg-indigo-50 text-indigo-900",
      "success" => "border-green-200 bg-green-50 text-green-900",
      "warning" => "border-amber-200 bg-amber-50 text-amber-900",
      "danger"  => "border-red-200 bg-red-50 text-red-900",
    }

    def initialize(data:)
      @text = data["text"].to_s
      @tone = TONES.fetch(data["tone"], TONES["info"])
    end

    def call
      content_tag(:aside, @text, class: "border-l-4 rounded-r-lg p-4 text-sm leading-relaxed my-4 #{@tone}")
    end
  end
end
