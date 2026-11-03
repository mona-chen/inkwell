class ThemePartRevision < ApplicationRecord
  belongs_to :theme_part_override

  validates :revision_number, presence: true
end
