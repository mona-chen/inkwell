class SiteCustomCss
  MAX_BYTES = 65_536

  def self.style_tag(site, nonce: nil)
    css = site&.setting("custom_css", "").to_s
    return "" if css.blank?

    # CSS must never be able to close its style element and introduce HTML/scripts.
    escaped = css.gsub("<") { "\\3c " }
    nonce_attribute = nonce.present? ? %( nonce="#{ERB::Util.html_escape(nonce)}") : ""
    %(<style data-ink-site-custom-css="true"#{nonce_attribute}>#{escaped}</style>)
  end
end
