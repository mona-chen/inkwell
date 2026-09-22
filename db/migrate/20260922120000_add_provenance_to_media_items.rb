class AddProvenanceToMediaItems < ActiveRecord::Migration[8.0]
  # A picture that came from outside the site (a stock search, a logo library, a screenshot
  # service) must remember where it came from: the licence governs how it may be used, and the
  # credit is an obligation in many of those licences. That record belongs to the FILE, not to
  # whatever plugin fetched it — deactivating a plugin must never orphan the attribution of
  # files already sitting in the library.
  def change
    add_column :media_items, :provider, :string
    add_column :media_items, :source_url, :string
    add_column :media_items, :credit, :string
    add_column :media_items, :credit_url, :string
    add_column :media_items, :license, :string
    add_index :media_items, :provider
  end
end
