# Mixed into Post and Page — gives both a shared, polymorphic way to carry categories/tags
# without duplicating the join-table wiring on every content model.
module Termable
  extend ActiveSupport::Concern

  included do
    has_many :post_terms, as: :termable, dependent: :destroy
    has_many :terms, through: :post_terms
  end

  def categories
    terms.where(taxonomy: "category")
  end

  def tags
    terms.where(taxonomy: "tag")
  end

  def term_ids_by_taxonomy=(hash)
    hash.each do |taxonomy, ids|
      terms.where(taxonomy: taxonomy).destroy_all
      Term.where(id: ids).each { |t| terms << t }
    end
  end
end
