module Blocks
  class CodeComponent < ViewComponent::Base
    def initialize(data:)
      @code = data["code"].to_s
      @language = data["language"]
    end

    def call
      content_tag(:pre, class: "bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono my-4 leading-relaxed") do
        safe_join([
          (content_tag(:div, @language, class: "text-xs text-gray-400 uppercase tracking-wide mb-2") if @language.present?),
          content_tag(:code, @code),
        ].compact)
      end
    end
  end
end
