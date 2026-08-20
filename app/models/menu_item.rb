class MenuItem < ApplicationRecord
  belongs_to :menu
  belongs_to :parent, class_name: "MenuItem", optional: true
  belongs_to :linkable, polymorphic: true, optional: true
  has_many :children, class_name: "MenuItem", foreign_key: :parent_id, dependent: :destroy

  validates :label, presence: true

  def resolved_url
    return url if url.present?
    return Rails.application.routes.url_helpers.polymorphic_path(linkable) if linkable

    "#"
  end
end
