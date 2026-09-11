class AddStatusToSiteCustomDomains < ActiveRecord::Migration[8.1]
  def change
    add_column :site_custom_domains, :status, :string, null: false, default: "pending"
    add_index :site_custom_domains, [:site_id, :status]
  end
end
