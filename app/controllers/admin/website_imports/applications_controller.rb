module Admin
  module WebsiteImports
    class ApplicationsController < BaseController
      def create
        website_import = Current.site.website_imports.find(params[:website_import_id])
        return redirect_to(admin_website_import_path(website_import), status: :see_other, alert: "Capture is not ready yet.") unless website_import.ready?

        website_import.update!(status: "importing", error_message: nil)
        payload = JSON.parse(website_import.capture_directory.join("site-builder-payload.json").read)
        pages = PageBuilder::CapturedSiteImporter.new(
          site: Current.site,
          user: current_user,
          capture_id: website_import.capture_id
        ).import!(payload)
        website_import.update!(status: "imported", imported_page_ids: pages.map { |page| page.fetch(:id) }, finished_at: Time.current)

        redirect_to pages.first.fetch(:builder_url), status: :see_other, notice: "Imported #{pages.size} editable pages."
      rescue JSON::ParserError, Errno::ENOENT => error
        website_import&.mark_failed!(error.message)
        redirect_to admin_website_import_path(website_import), status: :see_other, alert: "The mapped capture could not be read."
      rescue ActiveRecord::RecordInvalid, KeyError => error
        website_import&.mark_failed!(error.message)
        redirect_to admin_website_import_path(website_import), status: :see_other, alert: "The site could not be imported: #{error.message}"
      end
    end
  end
end
