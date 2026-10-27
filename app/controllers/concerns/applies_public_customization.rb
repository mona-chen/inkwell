module AppliesPublicCustomization
  extend ActiveSupport::Concern

  included do
    after_action :apply_public_customization
  end

  private

  def apply_public_customization
    public_page = %w[site posts pages authors theme_sites].include?(controller_path)
    builder_preview = controller_path == "page_builder/builder" && action_name == "preview"
    return unless public_page || builder_preview
    return unless response.media_type == "text/html" && !response.redirect? && response.body.is_a?(String)
    style = SiteCustomCss.style_tag(Current.site, nonce: content_security_policy_nonce)
    head_scripts = public_page ? Current.site&.setting("custom_scripts_head", "").to_s : ""
    body_scripts = public_page ? Current.site&.setting("custom_scripts_body", "").to_s : ""
    plugin_tags = public_page ? AgentAccess::LivePlugins.public_tags(Current.site, nonce: content_security_policy_nonce) : ""
    return if style.blank? && head_scripts.blank? && body_scripts.blank? && plugin_tags.blank?
    document = Nokogiri::HTML5.parse(response.body)
    document.css("style[data-ink-site-custom-css]").remove
    document.at_css("head").add_child(style) if style.present?
    # These are deliberately executable snippets supplied by a site administrator.
    { "head" => head_scripts, "body" => body_scripts }.each do |target, snippet|
      next if snippet.blank?
      fragment = Nokogiri::HTML5.fragment(snippet)
      if content_security_policy_nonce.present?
        fragment.css("script").each { |script| script["nonce"] = content_security_policy_nonce }
      end
      document.at_css(target).add_child(fragment)
    end
    document.at_css("body").add_child(Nokogiri::HTML5.fragment(plugin_tags)) if plugin_tags.present?
    response.body = document.to_html
  end
end
