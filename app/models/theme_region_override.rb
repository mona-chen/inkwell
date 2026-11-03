class ThemeRegionOverride < ApplicationRecord
  belongs_to :site

  validates :theme_release_id, :region_key, presence: true
  validates :region_key, uniqueness: { scope: [ :site_id, :theme_release_id ] }
end
