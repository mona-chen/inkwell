class CreateMenus < ActiveRecord::Migration[7.1]
  def change
    create_table :menus do |t|
      t.references :site, null: false, foreign_key: true
      t.string :name, null: false      # "Primary Navigation", "Footer"
      t.string :location, null: false  # theme-registered slot, e.g. "header" | "footer"
      t.timestamps
    end
    add_index :menus, [:site_id, :location], unique: true
  end
end
