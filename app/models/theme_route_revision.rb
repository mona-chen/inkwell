class ThemeRouteRevision < ApplicationRecord
  belongs_to :theme_route
  belongs_to :user, optional: true

  validates :revision_number, presence: true
end
