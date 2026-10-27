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

    def retry
      website_import = Current.site.website_imports.find(params[:id])
      website_import.with_lock do
        unless website_import.retryable?
          return redirect_to admin_website_import_path(website_import), status: :see_other, alert: "Only a failed capture can be retried."
        end
        website_import.update!(status: "queued", captured_pages: 0, mapped_pages: 0, report: {}, error_message: nil, started_at: nil, finished_at: nil)
      end
      WebsiteImportJob.perform_later(website_import.id)
      redirect_to admin_website_import_path(website_import), status: :see_other, notice: "Website capture restarted."
    end

    def destroy
      website_import = Current.site.website_imports.find(params[:id])
      trash_pages = params[:disposition] == "trash_pages"
      website_import.imported_pages.each { |page| authorize page, :destroy? } if trash_pages
      website_import.remove!(trash_pages: trash_pages)
      redirect_to admin_website_imports_path, status: :see_other, notice: trash_pages ? "Import removed. Its pages were moved to trash; you can restore them from Pages." : "Import removed. Pages and their assets were kept."
    rescue ActiveRecord::RecordInvalid => error
      redirect_to admin_website_import_path(website_import), status: :see_other, alert: error.record.errors.full_messages.to_sentence
    end

    private

    def website_import_params
      params.expect(website_import: %i[source_url additional_origins max_depth max_pages ownership_confirmed])
    end
  end
end
