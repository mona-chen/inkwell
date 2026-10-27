module Seo
  class ReadabilityAnalysis
    Result = Data.define(:id, :label, :status, :message)

    TRANSITIONS = %w[also because consequently finally first furthermore however meanwhile moreover nevertheless therefore thus].freeze

    attr_reader :record

    def initialize(record)
      @record = record
    end

    def results
      @results ||= if words.empty?
        [[:sentence_length, "Sentence length"], [:paragraph_length, "Paragraph length"], [:transition_words, "Transition words"], [:readability_headings, "Subheading distribution"], [:reading_ease, "Reading ease"]].map do |id, label|
          result(id, label, :improvement, "Add content to evaluate this check.")
        end
      else
        [sentence_length, paragraph_length, transition_words, subheading_distribution, reading_ease]
      end
    end

    def score
      return 0 if words.empty?
      weights = { good: 1.0, improvement: 0.55, problem: 0.0 }
      ((results.sum { |item| weights.fetch(item.status) } / results.length) * 100).round
    end

    private

    def document
      @document ||= ContentDocument.new(record.respond_to?(:editing_blocks) ? record.editing_blocks : record.content)
    end

    def text_blocks = document.paragraphs

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
      headings = document.headings
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
