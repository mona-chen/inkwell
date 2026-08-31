module Seo
  class ReadabilityAnalysis
    Result = Data.define(:id, :label, :status, :message)

    TRANSITIONS = %w[also because consequently finally first furthermore however meanwhile moreover nevertheless therefore thus].freeze

    attr_reader :record

    def initialize(record)
      @record = record
    end

    def results
      @results ||= [sentence_length, paragraph_length, transition_words, subheading_distribution, reading_ease]
    end

    def score
      weights = { good: 1.0, improvement: 0.55, problem: 0.0 }
      ((results.sum { |item| weights.fetch(item.status) } / results.length) * 100).round
    end

    private

    def blocks
      source = record.try(:draft_content).presence || record.try(:content).presence || []
      Array(source).select { |block| block.is_a?(Hash) }
    end

    def text_blocks
      blocks.filter_map do |block|
        data = block["data"] || block[:data] || {}
        value = data["text"] || data[:text] || data["content"] || data[:content]
        ActionView::Base.full_sanitizer.sanitize(value.to_s).squish.presence
      end
    end

    def text
      @text ||= text_blocks.join(" ")
    end

    def words
      @words ||= text.scan(/[[:alpha:]]+(?:['’-][[:alpha:]]+)*/)
    end

    def sentences
      @sentences ||= text.split(/(?<=[.!?])\s+/).filter(&:present?)
    end

    def result(id, label, status, message)
      Result.new(id:, label:, status:, message:)
    end

    def sentence_length
      long = sentences.count { |sentence| sentence.scan(/[[:alpha:]]+/).length > 20 }
      ratio = sentences.empty? ? 0 : long.fdiv(sentences.length)
      status = ratio <= 0.25 ? :good : ratio <= 0.4 ? :improvement : :problem
      result(:sentence_length, "Sentence length", status, "#{(ratio * 100).round}% of sentences exceed 20 words; aim below 25%.")
    end

    def paragraph_length
      long = text_blocks.count { |paragraph| paragraph.scan(/[[:alpha:]]+/).length > 150 }
      status = long.zero? ? :good : long == 1 ? :improvement : :problem
      result(:paragraph_length, "Paragraph length", status, long.zero? ? "Paragraphs are comfortably scannable." : "#{long} paragraph#{'s' unless long == 1} exceed 150 words.")
    end

    def transition_words
      count = words.count { |word| TRANSITIONS.include?(word.downcase) }
      ratio = words.empty? ? 0 : count.fdiv(words.length)
      status = ratio >= 0.01 ? :good : ratio.positive? ? :improvement : :problem
      result(:transition_words, "Transition words", status, count.positive? ? "#{count} transition word#{'s' unless count == 1} found." : "Use transitions to connect ideas and improve flow.")
    end

    def subheading_distribution
      headings = blocks.count { |block| (block["type"] || block[:type]).to_s == "heading" }
      expected = words.length / 300
      status = headings >= expected ? :good : headings.positive? ? :improvement : :problem
      result(:readability_headings, "Subheading distribution", status, "#{headings} subheading#{'s' unless headings == 1} across #{words.length} words.")
    end

    def reading_ease
      return result(:reading_ease, "Reading ease", :improvement, "Add more text to calculate reading ease.") if words.length < 30

      syllables = words.sum { |word| [word.downcase.scan(/[aeiouy]+/).length, 1].max }
      score = 206.835 - (1.015 * words.length.fdiv([sentences.length, 1].max)) - (84.6 * syllables.fdiv(words.length))
      status = score >= 60 ? :good : score >= 40 ? :improvement : :problem
      result(:reading_ease, "Reading ease", status, "Flesch score #{score.round}; 60–70 is easy for a broad audience.")
    end
  end
end
