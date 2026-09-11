module Multisite
  class SitePluginActivation < ApplicationRecord
    self.table_name = "site_plugin_activations"

    belongs_to :site
    belongs_to :installed_plugin

    validates :installed_plugin_id, uniqueness: { scope: :site_id }

    scope :active, -> { where(active: true) }
    scope :inactive, -> { where(active: false) }
  end
end
