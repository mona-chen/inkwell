class CreatePages < ActiveRecord::Migration[7.1]
  def change
    create_table :pages do |t|
      t.references :site, null: false, foreign_key: true
      t.references :author, null: false, foreign_key: { to_table: :users }
      t.references :parent, foreign_key: { to_table: :pages } # WP-style page hierarchy (e.g. /about/team)
      t.string :title, null: false
      t.string :slug, null: false
      t.jsonb :content, null: false, default: []
      t.string :template, null: false, default: "default" # theme can register alternate page templates
      t.string :status, null: false, default: "draft"
      t.integer :menu_order, null: false, default: 0
      t.jsonb :meta, null: false, default: {}
      t.timestamps
    end
    add_index :pages, [:site_id, :slug], unique: true
  end
end
