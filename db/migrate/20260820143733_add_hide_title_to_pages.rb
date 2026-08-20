class AddHideTitleToPages < ActiveRecord::Migration[8.1]
  def change
    add_column :pages, :hide_title, :boolean, default: false, null: false
  end
end
