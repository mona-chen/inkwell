class CreatePosts < ActiveRecord::Migration[7.1]
  def change
    create_table :posts do |t|
      t.references :site, null: false, foreign_key: true
      t.references :author, null: false, foreign_key: { to_table: :users }
      t.string :title, null: false
      t.string :slug, null: false
      t.text :excerpt
      # Block-structured content: [{ "type" => "heading", "data" => { "level" => 2, "text" => "..." } }, ...]
      # This is the entire "content" of the post — no separate raw-HTML column, so there is
      # no free-text render path to sanitize/exploit.
      t.jsonb :content, null: false, default: []
      t.string :status, null: false, default: "draft" # draft | published | scheduled | trashed
      t.datetime :published_at
      t.datetime :scheduled_for
      t.string :featured_image_alt
      t.jsonb :meta, null: false, default: {} # plugin-extensible bag (e.g. seo overrides) without new migrations
      t.timestamps
    end
    add_index :posts, [:site_id, :slug], unique: true
    add_index :posts, :status
    add_index :posts, :published_at
    add_index :posts, :content, using: :gin
  end
end
