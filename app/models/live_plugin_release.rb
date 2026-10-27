# Immutable packages: activation only changes the owning plugin's release pointer.
class LivePluginRelease < ApplicationRecord
  belongs_to :live_plugin
  before_update { throw :abort }
  validates :digest, presence: true
end
