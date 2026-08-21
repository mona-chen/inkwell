class Page < ApplicationRecord
  include Termable

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

  validates :title, presence: true
  validates :template, inclusion: { in: TEMPLATES }

  scope :published, -> { where(status: "published") }
  scope :ordered, -> { order(:menu_order) }

  def layout_label
    LAYOUTS.find { |l| l[:value] == template }&.dig(:label) || template.humanize
  end

  def content_blocks
    content || []
  end

  # In-progress draft the editor works on; committed to `content` on publish (see publish_draft!).
  def editing_blocks
    draft_content || content || []
  end

  def publish_draft!
    with_lock do
      update!(content: draft_content || [], draft_content: nil, status: "published")
    end
  end

  def content=(value)
    super(parse_json_value(value))
  end

  def draft_content=(value)
    super(parse_json_value(value))
  end

  def breadcrumbs
    parent ? parent.breadcrumbs + [self] : [self]
  end

  private

  def parse_json_value(value)
    return value unless value.is_a?(String)
    JSON.parse(value)
  rescue JSON::ParserError
    value
  end
end
