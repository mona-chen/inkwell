module PageBuilder
  class BuilderController < ::ApplicationController
    before_action :authenticate_user!
    before_action :require_admin_access!
    before_action :set_record, except: %i[index upload_asset]
    layout :resolve_layout

    # Builder.js uploads via a raw FormData fetch (no Rails CSRF header) from an already
    # authenticated admin session — skip token verification for this one action.
    protect_from_forgery with: :null_session, only: :upload_asset

    def index
      @posts = Current.site.posts.published.order(updated_at: :desc).limit(12)
      @pages = Current.site.pages.published.order(updated_at: :desc).limit(12)
    end

    def edit
      @html = builder_block&.dig("data", "html") || ""
      @saved_store = builder_block&.dig("data", "store") || {}
      @saved_custom_css = builder_block&.dig("data", "custom_css") || ""
      @saved_custom_js = builder_block&.dig("data", "custom_js") || ""
    end

    def save
      root = @record.is_a?(Page) ? "@page" : "@post"
      erb = ErbConverter.convert(params[:html].to_s, document_root: root)
      store = params[:store].presence
      custom_css = ErbConverter.convert(params[:custom_css].to_s, document_root: root)
      custom_js = ErbConverter.convert(params[:custom_js].to_s, document_root: root)

      blocks = @record.content_blocks.dup
      block = { "type" => "page_builder", "data" => { "html" => erb } }
      block["data"]["store"] = store if store
      block["data"]["custom_css"] = custom_css if custom_css.present?
      block["data"]["custom_js"] = custom_js if custom_js.present?
      idx = blocks.index { |b| b["type"] == "page_builder" }
      idx ? blocks[idx] = block : blocks << block
      @record.update!(content: blocks)

      render json: { ok: true, erb_length: erb.length }
    end

    # Builder.js assetUploadHandler: accepts a multipart file upload, stores it in the
    # site's media library, and returns { url: ... } as Builder.js expects.
    def upload_asset
      # Current.user is set by ApplicationController#set_current_attributes from the
      # authenticated session (see the User Load in the request log).
      item = Current.site.media_items.build(uploaded_by: Current.user)
      item.file.attach(params[:file])
      if item.save
        render json: { url: item.url }
      else
        render json: { error: item.errors.full_messages.to_sentence }, status: :unprocessable_entity
      end
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
