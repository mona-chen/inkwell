class AddAllowedOriginsToWebsiteImports < ActiveRecord::Migration[8.1]
  def change
    add_column :website_imports, :allowed_origins, :jsonb, default: [], null: false
  end
end
