class CreateSitePluginActivations < ActiveRecord::Migration[8.1]
  def change
    create_table :site_plugin_activations do |t|
      t.references :site, null: false, foreign_key: true
      t.references :installed_plugin, null: false, foreign_key: true
      t.boolean :active, default: true, null: false
      t.jsonb :settings, default: {}, null: false
      t.timestamps
    end

    add_index :site_plugin_activations, [ :site_id, :installed_plugin_id ], unique: true, name: "idx_site_plugin_unique"
  end
end
