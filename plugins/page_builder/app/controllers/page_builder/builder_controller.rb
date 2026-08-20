module PageBuilder
  class BuilderController < ::ApplicationController
    before_action :authenticate_user!
    before_action :require_admin_access!
    before_action :set_record, except: :index
    layout :resolve_layout

    def index
      @posts = Current.site.posts.published.order(updated_at: :desc).limit(12)
      @pages = Current.site.pages.published.order(updated_at: :desc).limit(12)
    end

    def edit
      @html = builder_block&.dig("data", "html") || ""
      @saved_store = builder_block&.dig("data", "store") || {}
    end

    def save
      erb = ErbConverter.convert(params[:html].to_s, document_root: @record.is_a?(Page) ? "@page" : "@post")
      store = params[:store].presence

      blocks = @record.content_blocks.dup
      block = { "type" => "page_builder", "data" => { "html" => erb } }
      block["data"]["store"] = store if store
      idx = blocks.index { |b| b["type"] == "page_builder" }
      idx ? blocks[idx] = block : blocks << block
      @record.update!(content: blocks)

      render json: { ok: true, erb_length: erb.length }
    end

    private

    def resolve_layout
      action_name == "index" ? "admin" : "page_builder"
    end

    def require_admin_access!
      redirect_to root_path, alert: "Not authorized" unless current_user&.can?(:manage_site) || current_user&.admin?
    end

    def set_record
      @record = if params[:record_type] == "page"
                  Current.site.pages.friendly.find(params[:record_id])
                else
                  Current.site.posts.friendly.find(params[:record_id])
                end
    end

    def builder_block
      @record.content_blocks.find { |b| b["type"] == "page_builder" }
    end
  end
end
