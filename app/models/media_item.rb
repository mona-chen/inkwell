class MediaItem < ApplicationRecord
  belongs_to :site
  belongs_to :uploaded_by, class_name: "User"
  # Synchronous purge so the blob + underlying file are removed immediately on delete —
  # there's no queue worker running in dev, so purge_later would leave orphaned files.
  has_one_attached :file

  before_destroy :purge_file!

  validates :file, presence: true

  # Filters let plugins add their own accepted types / transforms without touching this model,
  # e.g. an "SVG support" plugin could extend accepted_content_types via a filter.
  def self.accepted_content_types
    Inkwell::Hooks.filter(:media_accepted_content_types, %w[image/png image/jpeg image/webp image/gif application/pdf])
  end

  def url
    return unless file.attached?

    Rails.application.routes.url_helpers.rails_blob_path(file, only_path: true)
  end

  def kind
    file.content_type.to_s.start_with?("image/") ? "image" : "document"
  end

  def image?
    kind == "image"
  end

  def thumbnail_url
    return unless file.attached? && file.representable?

    Rails.application.routes.url_helpers.rails_representation_path(
      file.variant(resize_to_limit: [300, 300]).processed, only_path: true
    )
  rescue StandardError
    url # non-image files (pdf, etc) fall back to a direct link, no variant possible
  end

  private

  def purge_file!
    file.purge if file.attached?
  end
end
