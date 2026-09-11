class ApiToken < ApplicationRecord
  belongs_to :site

  has_secure_token :token

  validates :name, presence: true

  scope :active, -> { where(active: true) }

  # Marks the token as recently used without touching updated_at (keeps the "last used"
  # signal distinguishable from configuration edits).
  def touch_usage!
    update_column(:last_used_at, Time.current)
  end

  # Tokens are shown to the owner at creation time and thereafter by prefix only.
  def masked
    return "" if token.blank?

    "#{token[0, 8]}…#{token[-4, 4]}"
  end
end
