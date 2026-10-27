class AddPublicPathToPages < ActiveRecord::Migration[8.0]
  def change
    add_column :pages, :public_path, :string
    add_index :pages, [:site_id, :public_path], unique: true, where: "public_path IS NOT NULL"
  end
end
