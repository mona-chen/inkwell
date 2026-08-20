module Admin
  class PagesController < BaseController
    before_action :set_page, only: %i[edit update destroy publish]

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
      @page = Current.site.pages.build(page_params)
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
      if @page.update(page_params)
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
      @page.publish_draft!
      redirect_to edit_admin_page_path(@page), notice: "Published."
    end

    private

    def set_page
      @page = Current.site.pages.friendly.find(params[:id])
    end

    def page_params
      params.require(:page).permit(:title, :content, :draft_content, :status, :template, :hide_title, :menu_order, :parent_id)
    end
  end
end
