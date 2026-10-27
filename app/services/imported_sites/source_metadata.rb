module ImportedSites
  class SourceMetadata
    # A nil field has never been set. Empty strings are deliberate owner edits.
    def self.seed(page, only_missing: false)
      document = Nokogiri::HTML5.parse(page.original_import_html.to_s)
      values = { seo_title: document.at_css("title")&.text.presence }
      { seo_description: "meta[name='description']", og_title: "meta[property='og:title']",
        og_description: "meta[property='og:description']", og_image_url: "meta[property='og:image']" }.each do |attribute, selector|
        values[attribute] = document.at_css(selector)&.[]("content")
      end
      values.each do |attribute, value|
        page.public_send("#{attribute}=", value) unless only_missing && !page.public_send(attribute).nil?
      end
    end
  end
end
