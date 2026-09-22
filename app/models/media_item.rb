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

    Rails.application.routes.url_helpers.media_file_path(id)
  end

  def kind
    file.content_type.to_s.start_with?("image/") ? "image" : "document"
  end

  def image?
    kind == "image"
  end

  # True when this picture was acquired from an outside source rather than uploaded here. The
  # provenance columns are set by whoever fetched it (e.g. the Image Sources plugin) and stay
  # on the file afterwards, so a credit survives plugin removal.
  def external?
    provider.present?
  end

  # The line a page can show to satisfy a licence's attribution requirement, or nil when the
  # file was uploaded locally (no obligation). Unknown-creator items keep the provider name so
  # attribution is never silently dropped.
  def credit_line
    return unless external?

    [ credit.presence || provider, license.presence ].compact.join(" · ")
  end

  # One shape for the admin grid and the Copilot's media tools, so an acquired picture is
  # placed with the same fields as an uploaded one — plus the provenance the model should carry
  # onto the page.
  def library_json
    blob = file.blob
    {
      id: id,
      url: url,
      alt: alt_text.presence,
      caption: caption.presence,
      filename: blob&.filename&.to_s,
      kind: kind,
      width: blob&.metadata&.dig("width"),
      height: blob&.metadata&.dig("height"),
      provider: provider.presence,
      credit: credit.presence,
      credit_url: credit_url.presence,
      license: license.presence,
      source_url: source_url.presence
    }.compact
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
