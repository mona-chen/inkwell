module Admin
  class PagesController < BaseController
    before_action :set_page, only: %i[edit update destroy publish publish_original_import]

    def index
      @pages = Current.site.pages.includes(:author)
      @pages = @pages.where(status: params[:status]) if params[:status].present? && %w[draft published].include?(params[:status])
      @pages = @pages.where("title ILIKE ?", "%#{params[:q]}%") if params[:q].present?
      @pages = @pages.order(:menu_order).page(params[:page])
      render Admin::PagesPage.new(pages: @pages, status: params[:status], q: params[:q])
    end

    def new
      @page = Current.site.pages.build(author: current_user)
    end

    def create
      attrs = page_params.to_h
      # "Save draft" should always create a draft, even if the form says published
      attrs["status"] = "draft" if params[:save_draft].present?
      # Allow blank title for drafts — default to Untitled so friendly_id works
      attrs["title"] = "Untitled" if attrs["title"].blank? && attrs["status"] == "draft"
      @page = Current.site.pages.build(attrs)
      @page.author = current_user
      authorize @page

      if @page.save
        redirect_to edit_admin_page_path(@page), notice: "Page created."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def edit
      authorize @page
    end

    def update
      authorize @page
      attrs = page_params.to_h
      attrs["status"] = "draft" if params[:save_draft].present?
      attrs["title"] = @page.title.presence || "Untitled" if attrs["title"].blank? && (attrs["status"] == "draft" || @page.draft?)
      if @page.update(attrs)
        Inkwell::Hooks.fire(:post_updated, @page)
        respond_to do |format|
          format.json { render json: { ok: true, updated_at: @page.updated_at } }
          format.html { redirect_to edit_admin_page_path(@page), notice: "Saved." }
        end
      else
        respond_to do |format|
          format.json { render json: { errors: @page.errors.full_messages }, status: :unprocessable_entity }
          format.html { render :edit, status: :unprocessable_entity }
        end
      end
    end

    def destroy
      authorize @page
      @page.destroy
      redirect_to admin_pages_path, notice: "Page deleted."
    end

    def publish
      authorize @page
      # The Publish button submits the main form, so persist the serialized draft from the
      # hidden field before committing it to live content (covers deletes made right before publish).
      @page.update!(draft_content: page_params[:draft_content]) if params.dig(:page, :draft_content).present?
      @page.publish_native!
      redirect_to edit_admin_page_path(@page), notice: "Published."
    end

    def publish_original_import
      authorize @page
      @page.publish_original_import!
      redirect_to edit_admin_page_path(@page), notice: "Original import is live. Your native Builder version remains a draft."
    rescue ActiveRecord::RecordInvalid
      redirect_to edit_admin_page_path(@page), alert: "This page has no persisted original import to publish."
    end

    private

    def set_page
      @page = Current.site.pages.friendly.find(params[:id])
    end

    def page_params
      params.require(:page).permit(
        :title, :content, :draft_content, :status, :template, :hide_title, :menu_order, :parent_id,
        :seo_title, :seo_description, :seo_focus_keyword, :seo_slug_override,
        :og_title, :og_description, :og_image_url, :twitter_card_type,
        :twitter_title, :twitter_description, :twitter_image_url,
        :canonical_url_override, :breadcrumb_title, :cornerstone,
        :schema_page_type, :schema_article_type,
        :noindex, :nofollow, :robots_noarchive, :robots_noimageindex, :robots_nosnippet
      )
    end
  end
end
