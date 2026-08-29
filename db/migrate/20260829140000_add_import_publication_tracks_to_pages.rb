class AddImportPublicationTracksToPages < ActiveRecord::Migration[8.1]
  def change
    add_column :pages, :original_import_html, :text
    add_column :pages, :original_import_url, :string
    add_column :pages, :live_render_mode, :string, null: false, default: "native"
    add_index :pages, :live_render_mode
  end
end
