class CreateInstalledPlugins < ActiveRecord::Migration[7.1]
  def change
    create_table :installed_plugins do |t|
      t.string :slug, null: false
      t.string :name, null: false
      t.string :version
      t.boolean :active, null: false, default: false
      t.jsonb :settings, null: false, default: {}
      t.timestamps
    end
    add_index :installed_plugins, :slug, unique: true
  end
end
