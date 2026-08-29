class AddSeoMetadataToPostsAndPages < ActiveRecord::Migration[7.1]
  def change
    change_table :posts do |t|
      t.string :seo_title
      t.text :seo_description
      t.string :seo_focus_keyword
      t.string :seo_slug_override
      t.string :og_title
      t.text :og_description
      t.string :og_image_url
      t.string :twitter_card_type, default: "summary_large_image"
      t.boolean :noindex, default: false
      t.boolean :nofollow, default: false
    end

    change_table :pages do |t|
      t.string :seo_title
      t.text :seo_description
      t.string :seo_focus_keyword
      t.string :seo_slug_override
      t.string :og_title
      t.text :og_description
      t.string :og_image_url
      t.string :twitter_card_type, default: "summary_large_image"
      t.boolean :noindex, default: false
      t.boolean :nofollow, default: false
    end
  end
end
