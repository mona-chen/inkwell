class CreateOptions < ActiveRecord::Migration[7.1]
  def change
    # The one deliberate WP-style key-value table — for genuinely free-form site settings
    # (site title, tagline, social links, plugin-defined config) where a real column per
    # setting would mean a migration for every checkbox a plugin wants to add.
    create_table :options do |t|
      t.references :site, null: false, foreign_key: true
      t.string :key, null: false
      t.jsonb :value, null: false, default: {}
      t.timestamps
    end
    add_index :options, [:site_id, :key], unique: true
  end
end
