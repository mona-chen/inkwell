module Api
  # Shared base for the read-only API serializers. Emits a consistent JSON:API-flavoured
  # envelope: { id:, type:, attributes: }.
  class BaseSerializer
    def initialize(record, include_drafts: false, base_url: nil)
      @record = record
      @include_drafts = include_drafts
      @base_url = base_url
    end

    attr_reader :record

    def as_json
      { id: record.id.to_s, type: type, attributes: attributes }
    end

    def self.call(...) = new(...).as_json

    private

    def type
      self.class.name.demodulize.sub("Serializer", "").underscore
    end

    # Absolute URL against the site's canonical host (domain may include a dev port).
    def absolute(path)
      return nil if path.blank?
      return path if path.match?(%r{\Ahttps?://})

      "#{@base_url}#{path}"
    end

    def iso(time)
      time&.iso8601
    end
  end
end
