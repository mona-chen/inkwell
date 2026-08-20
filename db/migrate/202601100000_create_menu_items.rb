class CreateMenuItems < ActiveRecord::Migration[7.1]
  def change
    create_table :menu_items do |t|
      t.references :menu, null: false, foreign_key: true
      t.references :parent, foreign_key: { to_table: :menu_items } # dropdown submenus
      t.string :label, null: false
      t.string :url # for custom links
      t.references :linkable, polymorphic: true # for Post/Page-backed links that stay in sync with slug changes
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :menu_items, [:menu_id, :position]
  end
end
