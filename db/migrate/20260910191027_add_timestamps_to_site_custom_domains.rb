class AddTimestampsToSiteCustomDomains < ActiveRecord::Migration[8.1]
  def change
    add_column :site_custom_domains, :last_checked_at, :datetime
    add_column :site_custom_domains, :verified_at, :datetime
    add_column :site_custom_domains, :error_message, :text
  end
end
