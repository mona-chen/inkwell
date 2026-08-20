class Menu < ApplicationRecord
  belongs_to :site
  has_many :menu_items, -> { order(:position) }, dependent: :destroy

  validates :name, :location, presence: true
end
