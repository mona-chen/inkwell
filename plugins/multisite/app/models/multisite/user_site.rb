module Multisite
  class UserSite < ApplicationRecord
    self.table_name = "user_sites"

    belongs_to :user
    belongs_to :site

    ROLES = %w[admin editor author].freeze
    validates :role, inclusion: { in: ROLES }
    validates :user_id, uniqueness: { scope: :site_id, message: "already has access to this site" }
  end
end
