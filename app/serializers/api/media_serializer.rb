module Api
  class MediaSerializer < BaseSerializer
    def attributes
      return {} unless record.file.attached?

      file = record.file
      {
        filename: file.filename.to_s,
        content_type: file.content_type,
        byte_size: file.byte_size,
        kind: record.kind,
        alt_text: record.alt_text,
        caption: record.caption,
        path: record.url,
        url: absolute(record.url),
        created_at: iso(record.created_at)
      }.compact
    end
  end
end
