class CreateWebsiteImports < ActiveRecord::Migration[8.0]
  def change
    create_table :website_imports do |t|
      t.references :site, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :source_url, null: false
      t.string :capture_id, null: false
      t.string :status, null: false, default: "queued"
      t.integer :max_depth, null: false, default: 6
      t.integer :max_pages, null: false, default: 80
      t.boolean :ownership_confirmed, null: false, default: false
      t.integer :captured_pages, null: false, default: 0
      t.integer :mapped_pages, null: false, default: 0
      t.jsonb :report, null: false, default: {}
      t.jsonb :imported_page_ids, null: false, default: []
      t.text :error_message
      t.datetime :started_at
      t.datetime :finished_at
      t.timestamps

      t.index [:site_id, :created_at]
      t.index :capture_id, unique: true
      t.index :status
    end
  end
end
