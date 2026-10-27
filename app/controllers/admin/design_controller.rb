module Admin
  class DesignController < BaseController
    def edit_part
      key = params[:part].to_s
      raise ActiveRecord::RecordNotFound unless %w[header footer].include?(key)

      authorize Page.new(site: Current.site, author: current_user), :create?
      page = Current.site.with_lock do
        Current.site.pages.find_by(template_for: "site_#{key}") || begin
          part = Current.site.builder_site_parts[key]&.deep_dup || {
            "id" => "site-#{key}", "type" => "site-part", "settings" => { "partKey" => key }, "styles" => {}, "children" => []
          }
          Current.site.pages.create!(title: "Site #{key}", author: current_user, status: "draft", template: "landing", template_for: "site_#{key}", content: [
            { "type" => "page_builder", "data" => { "html" => "", "store" => { "version" => 2, "type" => "page", "settings" => { "title" => "Site #{key}" }, "children" => [part] } } }
          ])
        end
      end
      redirect_to "/builder/page/#{page.id}?panel=site"
    end

    def update
      values = params.require(:styles).permit(*SiteDesignStyles::COLORS.keys, *SiteDesignStyles::NUMBERS.keys, :font)
      Current.site.set_setting!("builder_styles", SiteDesignStyles.new(values.to_h).values)
      redirect_to admin_design_path(section: "styles"), notice: "Site styles saved. Explicit page and element overrides are preserved."
    end

    def show
      section = %w[overview parts styles].include?(params[:section]) ? params[:section] : "overview"
      render Admin::DesignPage.new(site: Current.site, section: section)
    end
  end
end
