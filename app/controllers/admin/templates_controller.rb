module Admin
  # Content templates: designate a page as the template for a content type (single post,
  # archive, index, or any role a plugin registers) and open it in the Builder.
  class TemplatesController < BaseController
    def index
      definitions = Page.template_role_definitions.reject { |definition| definition[:kind] == "site_part" }
      templates = definitions.index_by { |definition| definition[:role] }
        .transform_values { |definition| Current.site.pages.find_by(template_for: definition[:role]) }
      render Admin::TemplatesPage.new(template_definitions: definitions, templates: templates)
    end

    def create
      role = params[:role].to_s
      definition = Page.template_role_definition(role)
      return redirect_to admin_templates_path, alert: "Unknown template role." unless definition

      authorize Page.new(site: Current.site, author: current_user), :create?
      page = Current.site.with_lock do
        existing = Current.site.pages.find_by(template_for: role)
        existing || Current.site.pages.create!(
          title: definition[:label].presence || role.humanize,
          status: "draft", template: "default", author: current_user, template_for: role
        ).tap { |record| seed_template_content(record, definition[:content]) if definition[:content].present? }
      end
      redirect_to "/builder/page/#{page.id}"
    end

    # Removing an assignment preserves the design as an ordinary draft page.
    def reset
      page = Current.site.pages.find_by!(template_for: params[:role])
      authorize page, :update?
      page.update!(template_for: nil, status: "draft")
      redirect_to admin_templates_path, notice: "Theme default restored. Your design was kept as a draft page."
    end

    def discard
      page = Current.site.pages.find_by!(template_for: params[:role])
      authorize page, :update?
      page.update!(draft_content: nil)
      redirect_to admin_templates_path, notice: "Unpublished changes discarded. The live template is unchanged."
    end

    private

    def seed_template_content(page, content)
      return unless defined?(PageBuilder::ErbConverter)

      data =
        if content.is_a?(Hash)
          content.stringify_keys.slice("html", "store", "custom_css", "custom_js")
        else
          { "html" => PageBuilder::ErbConverter.convert(content.to_s, document_root: "@page") }
        end
      page.update!(content: [ { "type" => "page_builder", "data" => data } ])
    end
  end
end
