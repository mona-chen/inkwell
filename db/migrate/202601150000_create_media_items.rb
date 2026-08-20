class CreateMediaItems < ActiveRecord::Migration[7.1]
  def change
    # The file itself lives in ActiveStorage's own tables (active_storage_blobs/attachments,
    # installed via `rails active_storage:install`); this table is the library's metadata layer
    # — alt text, captions, uploader — the things WP stuffs into `wp_posts` with post_type
    # 'attachment' as a hack. Here it's just a real table.
    create_table :media_items do |t|
      t.references :site, null: false, foreign_key: true
      t.references :uploaded_by, null: false, foreign_key: { to_table: :users }
      t.string :alt_text
      t.string :caption
      t.timestamps
    end
  end
end
