class CreateSiteCustomDomains < ActiveRecord::Migration[8.1]
  def change
    create_table :site_custom_domains do |t|
      t.references :site, null: false, foreign_key: true
      t.string :domain, null: false
      t.timestamps
    end

    add_index :site_custom_domains, :domain, unique: true
  end
end
