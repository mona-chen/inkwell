module Admin
  class TaxonomiesController < BaseController
    before_action :set_taxonomy
    before_action :set_term, only: %i[update destroy]

    def index
      @terms = Current.site.terms.where(taxonomy: @taxonomy).order(:name)
      render Admin::TaxonomiesPage.new(terms: @terms, taxonomy: @taxonomy)
    end

    def create
      term = Current.site.terms.build(taxonomy: @taxonomy, name: params[:name], slug: params[:slug].presence)
      if term.save
        redirect_to admin_taxonomies_path(taxonomy: @taxonomy), notice: "#{@taxonomy.singularize.titleize} created."
      else
        redirect_to admin_taxonomies_path(taxonomy: @taxonomy), alert: term.errors.full_messages.to_sentence
      end
    end

    def update
      if @term.update(name: params[:name], slug: params[:slug].presence)
        redirect_to admin_taxonomies_path(taxonomy: @taxonomy), notice: "Updated."
      else
        redirect_to admin_taxonomies_path(taxonomy: @taxonomy), alert: @term.errors.full_messages.to_sentence
      end
    end

    def destroy
      @term.destroy
      redirect_to admin_taxonomies_path(taxonomy: @taxonomy), notice: "Deleted."
    end

    private

    def set_taxonomy
      @taxonomy = %w[category tag].include?(params[:taxonomy]) ? params[:taxonomy] : "category"
    end

    def set_term
      @term = Current.site.terms.find(params[:id])
    end
  end
end
