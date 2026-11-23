class AddAuthorProfilesAndEditorialFields < ActiveRecord::Migration[8.1]
  def change
    change_table :users, bulk: true do |t|
      t.string :job_title
      t.jsonb :profile_links, null: false, default: []
      t.references :avatar_item, foreign_key: { to_table: :media_items, on_delete: :nullify }, null: true
    end
    reversible do |direction|
      direction.up { change_column :users, :bio, :text }
      direction.down { change_column :users, :bio, :string }
    end

    add_column :posts, :content_modified_at, :datetime
    add_column :terms, :description, :text
  end
end
