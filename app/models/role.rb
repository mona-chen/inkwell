class Role < ApplicationRecord
  has_many :users

  CAPABILITIES = %w[
    manage_site manage_users manage_plugins manage_themes
    publish_posts edit_others_posts delete_posts
    edit_pages manage_menus moderate_comments upload_media
  ].freeze

  validates :name, presence: true, uniqueness: true

  def can?(capability)
    capabilities.include?(capability.to_s)
  end
end
