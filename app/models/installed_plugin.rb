class InstalledPlugin < ApplicationRecord
  validates :slug, :name, presence: true, uniqueness: { scope: :slug }
end
