module Seo
  # Plugin-owned PORO — deliberately not an ActiveRecord model for v1 (falls back to the
  # post's own excerpt/content). A future version could add a `seo_metadata` table owned
  # entirely by this plugin's own migrations under plugins/seo/db/migrate, with zero
  # changes required in core.
  class MetaTagBuilder
    def initialize(post)
      @post = post
    end

    def description
      return @post.excerpt if @post.excerpt.present?

      first_paragraph = @post.content_blocks.find { |b| b["type"] == "paragraph" }
      text = first_paragraph&.dig("data", "text").to_s
      text.truncate(155, separator: " ")
    end
  end
end
