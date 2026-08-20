class PostTerm < ApplicationRecord
  belongs_to :term
  belongs_to :termable, polymorphic: true
end
