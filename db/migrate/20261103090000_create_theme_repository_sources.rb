class CreateThemeRepositorySources < ActiveRecord::Migration[8.1]
  def change
    create_table :theme_repository_sources do |t|
      t.references :site, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :repository, null: false
      t.string :branch, null: false, default: "main"
      t.boolean :auto_update, null: false, default: false
      t.boolean :auto_activate, null: false, default: false
      t.boolean :spa, null: false, default: false
      t.string :deployed_sha
      t.string :installed_slug
      t.string :status, null: false, default: "queued"
      t.text :error_message
      t.jsonb :releases, null: false, default: []
      t.datetime :checked_at
      t.timestamps
    end
  end
end
