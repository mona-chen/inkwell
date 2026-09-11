class CreateUserSites < ActiveRecord::Migration[8.1]
  def change
    create_table :user_sites do |t|
      t.references :user, null: false, foreign_key: true
      t.references :site, null: false, foreign_key: true
      t.string :role, default: "editor", null: false
      t.timestamps
    end

    add_index :user_sites, [ :user_id, :site_id ], unique: true
  end
end
