class CreateSites < ActiveRecord::Migration[7.1]
  def change
    # Single-site by default (one row), but every content table below carries a site_id FK
    # so multisite is additive later, not a migration-hell rewrite.
    create_table :sites do |t|
      t.string :name, null: false
      t.string :domain, null: false
      t.string :active_theme, null: false, default: "default"
      t.timestamps
    end
    add_index :sites, :domain, unique: true
  end
end
