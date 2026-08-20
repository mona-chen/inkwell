class Option < ApplicationRecord
  belongs_to :site
  validates :key, presence: true, uniqueness: { scope: :site_id }
end
