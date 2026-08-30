class Page < ApplicationRecord
  include Termable
  include BuilderPayloadPreserving

  # Page layout — mirrors Elementor's Page Layout setting. `template` is the persisted
  # column (kept for compatibility); these are the documented options with copy shown in
  # the editor sidebar.
  TEMPLATES = %w[default full-width landing].freeze

  LAYOUTS = [
    { value: "default", label: "Default", description: "Content in the theme's standard container with header and footer." },
    { value: "full-width", label: "Full width", description: "Edge-to-edge content spanning the full screen; header and footer still show." },
    { value: "landing", label: "Canvas", description: "Blank canvas with no header or footer — ideal for landing pages." }
  ].freeze

  belongs_to :site
  belongs_to :author, class_name: "User"
  belongs_to :parent, class_name: "Page", optional: true
  has_many :children, class_name: "Page", foreign_key: :parent_id, dependent: :nullify

  extend FriendlyId
  friendly_id :title, use: :slugged

  validates :title, presence: true, unless: :draft?
  validates :template, inclusion: { in: TEMPLATES }

  def draft?
    status == "draft" || status.blank?
  end

  scope :published, -> { where(status: "published") }
  scope :ordered, -> { order(:menu_order) }

  LIVE_RENDER_MODES = %w[native original_import].freeze

  validates :live_render_mode, inclusion: { in: LIVE_RENDER_MODES }

  def original_import_available?
    original_import_html.present? && original_import_url.present?
  end

  def publish_native!
    publish_draft!
    update!(live_render_mode: "native")
  end

  def publish_original_import!
    raise ActiveRecord::RecordInvalid, self unless original_import_available?

    update!(status: "published", live_render_mode: "original_import")
  end

  def layout_label
    LAYOUTS.find { |l| l[:value] == template }&.dig(:label) || template.humanize
  end

  def content_blocks
    content || []
  end

  # In-progress draft the editor works on; committed to `content` on publish (see publish_draft!).
  def editing_blocks
    draft = draft_content
    if stale_builder_draft?(draft)
      content || []
    else
      draft || content || []
    end
  end

  # A draft whose page_builder block carries no HTML while the published content does is stale
  # (e.g. an accidental autosave of an empty build) — never let it blank out the real design.
  def stale_builder_draft?(draft)
    return false unless draft.is_a?(Array)

    draft_builder = draft.select { |b| b["type"] == "page_builder" }
    return false if draft_builder.empty? || draft_builder.any? { |b| b["data"]["html"].to_s.present? }

    content_blocks.any? { |b| b["type"] == "page_builder" && b["data"]["html"].to_s.present? }
  end

  def publish_draft!
    with_lock do
      update!(content: publishable_draft_content, draft_content: nil, status: "published")
    end
  end

  # --- SEO helpers ---

  def seo_title_display
    seo_title.presence || title
  end

  def seo_description_display
    seo_description.presence || auto_meta_description
  end

  def seo_og_title
    og_title.presence || title
  end

  def seo_og_description
    og_description.presence || seo_description.presence || auto_meta_description
  end

  def seo_og_image
    og_image_url.presence
  end

  def canonical_url
    "/pages/#{slug}"
  end

  def auto_meta_description
    text = content_blocks.map { |b| b.dig("data", "text").to_s }.join(" ")
    text.present? ? text.truncate(300) : nil
  end

  def content=(value)
    super(parse_json_value(value))
  end

  def draft_content=(value)
    super(parse_json_value(value))
  end

  def breadcrumbs
    parent ? parent.breadcrumbs + [ self ] : [ self ]
  end

  private

  def parse_json_value(value)
    return value unless value.is_a?(String)
    JSON.parse(value)
  rescue JSON::ParserError
    value
  end
end
