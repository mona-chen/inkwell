class EnforceUniqueContentTemplateRoles < ActiveRecord::Migration[8.0]
  def change
    add_index :pages, [:site_id, :template_for], unique: true,
      where: "template_for IS NOT NULL", name: "index_pages_unique_template_role"
  end
end
