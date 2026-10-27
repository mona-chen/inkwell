class LivePlugin < ApplicationRecord
  belongs_to :site
  belongs_to :active_release, class_name: "LivePluginRelease", optional: true
  has_many :releases, class_name: "LivePluginRelease", dependent: :destroy
  before_destroy(prepend: true) { update_column(:active_release_id, nil) }
  validates :slug, format: { with: /\A[a-z][a-z0-9_]{0,39}\z/ }, uniqueness: { scope: :site_id }
  validate do
    errors.add(:active_release, "belongs to another plugin") if active_release && active_release.live_plugin_id != id
  end
end
