class AddMultitenancyColumnsToSites < ActiveRecord::Migration[8.1]
  def change
    add_column :sites, :subdomain, :string
    add_column :sites, :is_default, :boolean, default: false, null: false
    add_column :sites, :active, :boolean, default: true, null: false
    add_column :sites, :logo_url, :string
    add_column :sites, :plan, :string, default: "free", null: false
    add_column :sites, :settings, :jsonb, default: {}, null: false

    add_index :sites, :subdomain, unique: true, where: "subdomain IS NOT NULL"
    add_index :sites, :is_default, unique: true, where: "is_default = true"
  end
end
