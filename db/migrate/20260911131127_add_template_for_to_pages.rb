class AddTemplateForToPages < ActiveRecord::Migration[8.1]
  def change
    add_column :pages, :template_for, :string
    add_index :pages, [ :site_id, :template_for ]
  end
end
