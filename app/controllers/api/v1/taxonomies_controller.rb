module Api
  module V1
    class TaxonomiesController < Api::BaseController
      def index
        terms = Current.site.terms
        terms = terms.where(taxonomy: params[:taxonomy]) if params[:taxonomy].present?
        terms = terms.order(:taxonomy, :name)

        render_jsonapi(terms.map { |term| serialize(Api::TaxonomySerializer, term) })
      end
    end
  end
end
