module Api
  class TaxonomySerializer < BaseSerializer
    def attributes
      {
        taxonomy: record.taxonomy,
        name: record.name,
        slug: record.slug,
        parent_id: record.parent_id&.to_s
      }.compact
    end
  end
end
