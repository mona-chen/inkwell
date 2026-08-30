module PageBuilder
  class BuilderController < ::ApplicationController
    before_action :authenticate_user!
    before_action :require_admin_access!
    before_action :set_record, except: %i[index upload_asset workspace_pages workspace_captures workspace_capture import_workspace_capture]
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
      @saved_html_body = @html.to_s[/<body[^>]*>(.*?)<\/body>/m, 1].presence || @html.to_s
      @site_parts = Current.site.builder_site_parts
      # Builder v2 intentionally starts from its normalized recursive store. The email-era
      # elementLists model and HTML-to-store reconstruction are not compatibility constraints.
      @saved_store = {} unless @saved_store["version"] == 2
      @html_design = false
    end

    def preview
      ThemeManager.activate_for_request!(self, Current.site.active_theme, preview: true)
      template = @record.is_a?(Page) ? "pages/#{@record.template}" : "posts/show"
      locals = @record.is_a?(Page) ? { page: @record } : { post: @record }
      render template: template, locals: locals, layout: "application"
    rescue ActionView::MissingTemplate
      fallback = @record.is_a?(Page) ? "pages/default" : "posts/show"
      render fallback, locals: locals, layout: "application"
    end

    def workspace_pages
      pages = Current.site.pages.ordered.includes(:author).map do |page|
        block = page.content_blocks.find { |item| item["type"] == "page_builder" }
        {
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
          template: page.template,
          updated_at: page.updated_at.iso8601,
          builder_url: "/builder/page/#{page.id}",
          public_url: page.status == "published" ? "/pages/#{page.slug}" : nil,
          preview_html: block&.dig("data", "html").to_s
        }
      end
      render json: { pages: pages }
    end

    # Captures are deliberately read from a server-owned directory and addressed by a strict
    # slug. The browser never submits an arbitrary filesystem path, and copied scripts are not
    # returned: only the reviewed, native builder payload produced by map-site-capture.js is.
    def workspace_captures
      captures = Dir.children(site_captures_root).filter_map do |capture_id|
        next unless valid_capture_id?(capture_id)

        directory = site_captures_root.join(capture_id)
        manifest_path = directory.join("manifest.json")
        next unless directory.directory? && manifest_path.file?

        manifest = JSON.parse(manifest_path.read)
        payload_path = directory.join(manifest["format"] == "ink-site-capture-v2" ? "site-builder-payload.json" : "builder-payload.json")
        next unless payload_path.file?

        payload = JSON.parse(payload_path.read)
        report = payload.fetch("importReport", {})
        {
          id: capture_id,
          source: manifest["source"],
          captured_at: manifest["capturedAt"] || manifest["captured_at"],
          kind: payload["format"] == "ink-builder-site-import-v1" ? "site" : "page",
          pages: report["mappedPages"] || 1,
          native_sections: report["nativeSections"] || payload.fetch("pages", []).sum { |page| page.dig("payload", "importReport", "nativeSections").to_i },
          captured_nodes: report["capturedNodes"] || payload.fetch("pages", []).sum { |page| page.dig("payload", "importReport", "capturedNodes").to_i }
        }
      rescue JSON::ParserError
        nil
      end
      render json: { captures: captures.sort_by { |capture| capture[:id] } }
    end

    def workspace_capture
      return render json: { error: "Invalid capture" }, status: :bad_request unless valid_capture_id?(params[:capture_id])

      directory = site_captures_root.join(params[:capture_id])
      payload_path = directory.join("site-builder-payload.json")
      payload_path = directory.join("builder-payload.json") unless payload_path.file?
      return render json: { error: "Capture not found" }, status: :not_found unless payload_path.file?

      render json: JSON.parse(payload_path.read)
    rescue JSON::ParserError
      render json: { error: "Capture payload is invalid" }, status: :unprocessable_entity
    end

    def import_workspace_capture
      return render json: { error: "Invalid capture" }, status: :bad_request unless valid_capture_id?(params[:capture_id])

      payload_path = site_captures_root.join(params[:capture_id], "site-builder-payload.json")
      return render json: { error: "Mapped site capture not found" }, status: :not_found unless payload_path.file?

      site_payload = JSON.parse(payload_path.read)
      return render json: { error: "Unsupported site payload" }, status: :unprocessable_entity unless site_payload["format"] == "ink-builder-site-import-v1"

      imported = import_captured_pages!(site_payload, params[:capture_id])
      render json: { ok: true, pages: imported, first_builder_url: imported.first&.fetch(:builder_url) }
    rescue JSON::ParserError
      render json: { error: "Site payload is invalid" }, status: :unprocessable_entity
    rescue ActiveRecord::RecordInvalid => error
      render json: { error: error.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end

    def save
      root = @record.is_a?(Page) ? "@page" : "@post"
      erb = ErbConverter.convert(params[:html].to_s, document_root: root)
      store = params[:store].presence
      custom_css = ErbConverter.convert(params[:custom_css].to_s, document_root: root)
      custom_js = ErbConverter.convert(params[:custom_js].to_s, document_root: root)
      if params[:site_parts].present?
        site_parts = params[:site_parts].respond_to?(:to_unsafe_h) ? params[:site_parts].to_unsafe_h : params[:site_parts].to_h
        # A page only submits the global parts it currently references. Merge those edited
        # canonical trees into the site registry; never erase an unrelated footer simply
        # because the current page only uses a header (or vice versa).
        Current.site.set_builder_site_parts!(Current.site.builder_site_parts.merge(site_parts.slice("header", "footer")))
      end

      blocks = @record.content_blocks.dup
      block = { "type" => "page_builder", "data" => { "html" => erb } }
      block["data"]["store"] = store if store
      block["data"]["custom_css"] = custom_css if custom_css.present?
      block["data"]["custom_js"] = custom_js if custom_js.present?
      idx = blocks.index { |b| b["type"] == "page_builder" }
      idx ? blocks[idx] = block : blocks << block
      attributes = { content: blocks }
      if ActiveModel::Type::Boolean.new.cast(params[:publish])
        attributes[:status] = "published"
        attributes[:live_render_mode] = "native" if @record.is_a?(Page)
        attributes[:draft_content] = nil if @record.has_attribute?(:draft_content)
      end
      @record.update!(attributes)

      render json: {
        ok: true,
        erb_length: erb.length,
        status: @record.status,
        public_url: public_record_url,
        preview_url: preview_record_url
      }
    end

    def publish_original_import
      return render json: { error: "Only imported pages have an original publication track." }, status: :unprocessable_entity unless @record.is_a?(Page) && @record.original_import_available?

      @record.publish_original_import!
      render json: { ok: true, status: @record.status, live_render_mode: @record.live_render_mode, public_url: public_record_url }
    rescue ActiveRecord::RecordInvalid
      render json: { error: @record.errors.full_messages.to_sentence.presence || "Original import cannot be published." }, status: :unprocessable_entity
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
      return "admin" if action_name == "index"
      return "application" if action_name == "preview"

      "page_builder"
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

    def public_record_url
      return unless @record.status == "published"

      @record.is_a?(Page) ? "/pages/#{@record.slug}" : "/posts/#{@record.slug}"
    end

    def preview_record_url
      "/builder/#{@record.is_a?(Page) ? 'page' : 'post'}/#{@record.id}/preview"
    end

    def site_captures_root
      Rails.root.join("tmp", "site-captures")
    end

    def valid_capture_id?(capture_id)
      capture_id.to_s.match?(/\A[a-z0-9][a-z0-9_-]*\z/i)
    end

    def import_captured_pages!(site_payload, capture_id)
      CapturedSiteImporter.new(site: Current.site, user: current_user, capture_id: capture_id).import!(site_payload)
    end

    def unique_import_slug(desired, reserved = Set.new)
      base = desired.to_s.parameterize.presence || "imported-page"
      candidate = base
      suffix = 2
      while reserved.include?(candidate) || Current.site.pages.exists?(slug: candidate)
        candidate = "#{base}-#{suffix}"
        suffix += 1
      end
      candidate
    end

    # The native store is editable, but the captured source is also a deliberate publication
    # artifact. Persist it on the Page during import so the public original track never relies
    # on tmp/site-captures surviving a deploy. Its base URL keeps original CSS, fonts, media,
    # and runtime dependencies resolving while the native version is rebuilt.
    def imported_source_html(capture_id, source_url)
      manifest_path = Dir.glob(site_captures_root.join(capture_id, "pages", "*", "manifest.json").to_s).find do |path|
        JSON.parse(File.read(path))["source"] == source_url
      rescue JSON::ParserError
        false
      end
      return nil unless manifest_path

      source_path = Pathname.new(manifest_path).dirname.join("source.html")
      return nil unless source_path.file?

      html = source_path.read
      base = %(<base href="#{ERB::Util.html_escape(source_url)}">)
      return html if html.match?(/<base\b/i)

      if html.match?(/<head([^>]*)>/i)
        html.sub(/<head([^>]*)>/i, "<head\\1>#{base}")
      else
        "<!doctype html><html><head>#{base}</head><body>#{html}</body></html>"
      end
    end

    def rewrite_import_links!(nodes, slugs)
      Array(nodes).each do |node|
        url = node.dig("settings", "url")
        if url.to_s.start_with?("/pages/")
          desired = url.delete_prefix("/pages/")
          node["settings"]["url"] = "/pages/#{slugs.fetch(desired, desired)}"
        end
        rewrite_import_links!(node["children"], slugs)
      end
    end

    def rewrite_import_html_links(html, slugs)
      slugs.reduce(html.to_s) do |result, (desired, actual)|
        result.gsub(%r{(?<=["'])/pages/#{Regexp.escape(desired)}(?=(?:[?#][^"']*)?["'])}, "/pages/#{actual}")
      end
    end

    def materialize_import_node(node)
      materialized = {
        "id" => SecureRandom.uuid,
        "type" => node.fetch("type"),
        "settings" => node.fetch("settings", {}).deep_dup,
        "styles" => node.fetch("styles", {}),
        "children" => Array(node["children"]).map { |child| materialize_import_node(child) }
      }

      bind_imported_background!(materialized)
      materialized
    end

    def bind_imported_background!(node)
      return unless node["type"] == "container"

      layer = Array(node["children"]).find do |child|
        child.dig("settings", "importedLabel").to_s.match?(/background(?: image)?/i)
      end
      image = imported_descendant(layer, "image")
      return unless image

      node["settings"]["importedBackgroundImageId"] = image.fetch("id")
    end

    def imported_descendant(node, type)
      return unless node
      return node if node["type"] == type

      Array(node["children"]).each do |child|
        match = imported_descendant(child, type)
        return match if match
      end
      nil
    end
  end
end
