require "base64"
require "json"

class StabilizeEmbeddedMediaUrls < ActiveRecord::Migration[8.1]
  class EmbeddedPost < ActiveRecord::Base
    self.table_name = "posts"
  end

  class EmbeddedPage < ActiveRecord::Base
    self.table_name = "pages"
  end

  def up
    blob_to_media = select_rows(<<~SQL.squish).to_h.transform_keys(&:to_s)
      SELECT blob_id, record_id
      FROM active_storage_attachments
      WHERE record_type = 'MediaItem' AND name = 'file'
    SQL

    [EmbeddedPost, EmbeddedPage].each do |model|
      model.find_each do |record|
        changes = {}
        %w[content draft_content].each do |column|
          value = record.public_send(column)
          rewritten = rewrite_blocks(value, blob_to_media)
          changes[column] = rewritten if rewritten != value
        end
        record.update_columns(changes) if changes.any?
      end
    end
  end

  def down
    # Stable media URLs remain valid indefinitely and should not be converted back to signed URLs.
  end

  private

  def rewrite_blocks(value, blob_to_media)
    return value unless value.is_a?(Array)

    value.map do |block|
      next block unless block.is_a?(Hash) && block["data"].is_a?(Hash)

      data = block["data"].transform_values do |entry|
        entry.is_a?(String) ? rewrite_url(entry, blob_to_media) : entry
      end
      block.merge("data" => data)
    end
  end

  def rewrite_url(value, blob_to_media)
    match = value.match(%r{\A/rails/active_storage/blobs/(?:redirect|proxy)/([^/]+)/})
    return value unless match

    payload = match[1].split("--", 2).first
    decoded = JSON.parse(Base64.strict_decode64(payload))
    blob_id = decoded.dig("_rails", "data").to_s
    media_id = blob_to_media[blob_id]
    media_id ? "/media/#{media_id}/file" : value
  rescue ArgumentError, JSON::ParserError
    value
  end
end
