module Admin
  class WebsiteImportsController < BaseController
    def index
      render Admin::WebsiteImportsPage.new(imports: Current.site.website_imports.recent)
    end

    def new
      render Admin::WebsiteImportForm.new(website_import: Current.site.website_imports.build(user: current_user))
    end

    def create
      website_import = Current.site.website_imports.build(website_import_params.merge(user: current_user))
      if website_import.save
        WebsiteImportJob.perform_later(website_import.id)
        redirect_to admin_website_import_path(website_import), status: :see_other, notice: "Website capture started."
      else
        render Admin::WebsiteImportForm.new(website_import: website_import), status: :unprocessable_entity
      end
    end

    def show
      website_import = Current.site.website_imports.find(params[:id])
      render Admin::WebsiteImportPage.new(website_import: website_import)
    end

    def destroy
      website_import = Current.site.website_imports.find(params[:id])
      website_import.destroy
      redirect_to admin_website_imports_path, notice: "Import removed."
    end

    private

    def website_import_params
      params.expect(website_import: %i[source_url max_depth max_pages ownership_confirmed])
    end
  end
end
