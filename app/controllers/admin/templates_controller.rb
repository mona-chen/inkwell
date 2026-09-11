module Admin
  # Content templates: designate a page as the template for a content type (single post,
  # archive, index, or any role a plugin registers) and open it in the Builder.
  class TemplatesController < BaseController
    def index
      definitions = Page.template_role_definitions
      templates = definitions.index_by { |definition| definition[:role] }
        .transform_values { |definition| Page.template_for(Current.site, definition[:role]) }
      render Admin::TemplatesPage.new(template_definitions: definitions, templates: templates)
    end

    def create
      role = params[:role].to_s
      definition = Page.template_role_definition(role)
      return redirect_to admin_templates_path, alert: "Unknown template role." unless definition

      page = Current.site.pages.create!(
        title: definition[:label].presence || role.humanize,
        status: "draft",
        template: "default",
        author: current_user,
        template_for: role
      )
      seed_template_content(page, definition[:content]) if definition[:content].present?
      redirect_to "/builder/page/#{page.id}"
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
