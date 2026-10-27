module Seo
  class ContentAnalysis
    Result = Data.define(:id, :label, :status, :message)

    attr_reader :record

    def initialize(record)
      @record = record
    end

    def results
      @results ||= [
        title_length,
        description_length,
        keyphrase_in_title,
        keyphrase_in_description,
        keyphrase_in_introduction,
        keyphrase_density,
        content_length,
        heading_structure,
        outbound_links,
        images,
        keyphrase_in_slug
      ]
    end

    def score
      return 0 if results.empty?

      weights = { good: 1.0, improvement: 0.55, problem: 0.0 }
      ((results.sum { |result| weights.fetch(result.status) } / results.length) * 100).round
    end

    private

    def result(id, label, status, message)
      Result.new(id:, label:, status:, message:)
    end

    def title
      record.try(:seo_title).presence || record.try(:title).to_s
    end

    def description
      record.try(:seo_description).presence || record.try(:excerpt).presence || document.text.truncate(160)
    end

    def keyphrase
      record.try(:seo_focus_keyword).to_s.strip.downcase
    end

    def document
      @document ||= ContentDocument.new(record.respond_to?(:editing_blocks) ? record.editing_blocks : record.content)
    end

    def text = document.text
    def words = document.words

    def includes_keyphrase?(value)
      keyphrase.present? && value.to_s.downcase.include?(keyphrase)
    end

    def title_length
      length = title.length
      status = length.between?(30, 60) ? :good : length.between?(15, 70) ? :improvement : :problem
      result(:title_length, "SEO title length", status, "#{length} characters; aim for 30–60.")
    end

    def description_length
      length = description.length
      status = length.between?(120, 155) ? :good : length.between?(70, 165) ? :improvement : :problem
      result(:description_length, "Meta description length", status, "#{length} characters; aim for 120–155.")
    end

    def keyphrase_in_title
      keyphrase_result(:keyphrase_title, "Keyphrase in SEO title", title)
    end

    def keyphrase_in_description
      keyphrase_result(:keyphrase_description, "Keyphrase in meta description", description)
    end

    def keyphrase_in_introduction
      keyphrase_result(:keyphrase_introduction, "Keyphrase in introduction", words.first(100).join(" "))
    end

    def keyphrase_result(id, label, value)
      return result(id, label, :improvement, "Add a focus keyphrase to evaluate this.") if keyphrase.blank?

      includes_keyphrase?(value) ? result(id, label, :good, "The focus keyphrase is present.") : result(id, label, :problem, "Use the focus keyphrase here naturally.")
    end

    def keyphrase_density
      return result(:keyphrase_density, "Keyphrase density", :improvement, "Add a focus keyphrase to evaluate this.") if keyphrase.blank?

      occurrences = text.downcase.scan(Regexp.new(Regexp.escape(keyphrase))).length
      density = words.empty? ? 0 : (occurrences * keyphrase.split.length * 100.0 / words.length)
      status = density.between?(0.5, 3.0) ? :good : density.positive? && density < 4.0 ? :improvement : :problem
      result(:keyphrase_density, "Keyphrase density", status, "#{occurrences} use#{'s' unless occurrences == 1} (#{density.round(1)}%).")
    end

    def content_length
      count = words.length
      status = count >= 300 ? :good : count >= 150 ? :improvement : :problem
      result(:content_length, "Content length", status, "#{count} words; aim for at least 300 where appropriate.")
    end

    def heading_structure
      headings = document.headings
      status = headings.positive? ? :good : words.length < 200 ? :improvement : :problem
      result(:headings, "Subheading distribution", status, headings.positive? ? "#{headings} subheading#{'s' unless headings == 1} found." : "Break longer content into descriptive subheadings.")
    end

    def outbound_links
      links = document.links
      status = links.positive? ? :good : :improvement
      result(:links, "Links", status, links.positive? ? "#{links} link#{'s' unless links == 1} found." : "Consider adding a useful internal or external link.")
    end

    def images
      image_blocks = document.images
      present = record.try(:featured_image_url).present? || image_blocks.any?
      missing_alt = image_blocks.any? { |image| image["alt"].blank? }
      missing_alt ||= record.try(:featured_image_id).present? && record.try(:featured_image_alt).blank?
      status = !present ? :improvement : missing_alt ? :problem : :good
      message = if !present
        "Add a relevant image and descriptive alt text."
      elsif missing_alt
        "At least one image is missing alternative text."
      else
        "Images have usable alternative text."
      end
      result(:images, "Images", status, message)
    end

    def keyphrase_in_slug
      slug = record.try(:seo_slug_override).presence || record.try(:slug).to_s
      keyphrase_result(:keyphrase_slug, "Keyphrase in slug", slug.tr("-", " "))
    end
  end
end
