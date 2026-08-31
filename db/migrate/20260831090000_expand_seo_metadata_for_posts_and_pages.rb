class ExpandSeoMetadataForPostsAndPages < ActiveRecord::Migration[8.1]
  SEO_COLUMNS = {
    canonical_url_override: :string,
    breadcrumb_title: :string,
    cornerstone: { type: :boolean, default: false, null: false },
    robots_noarchive: { type: :boolean, default: false, null: false },
    robots_noimageindex: { type: :boolean, default: false, null: false },
    robots_nosnippet: { type: :boolean, default: false, null: false },
    schema_page_type: { type: :string, default: "WebPage" },
    schema_article_type: { type: :string, default: "Article" },
    twitter_title: :string,
    twitter_description: :text,
    twitter_image_url: :string
  }.freeze

  def change
    %i[posts pages].each do |table|
      SEO_COLUMNS.each do |name, definition|
        if definition.is_a?(Hash)
          type = definition.fetch(:type)
          add_column table, name, type, **definition.except(:type)
        else
          add_column table, name, definition
        end
      end
    end
  end
end
