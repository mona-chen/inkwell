class Term < ApplicationRecord
  has_ancestry # nested categories, tags stay flat by never getting children

  belongs_to :site
  has_many :post_terms, dependent: :destroy

  validates :name, :taxonomy, presence: true

  before_validation { self.slug ||= name&.parameterize }

  scope :categories, -> { where(taxonomy: "category") }
  scope :tags, -> { where(taxonomy: "tag") }
end
