class Post < ApplicationRecord
  include Termable
  include Revisable

  belongs_to :site
  belongs_to :author, class_name: "User"
  has_many :comments, dependent: :destroy
  belongs_to :featured_image, class_name: "MediaItem", optional: true

  extend FriendlyId
  friendly_id :title, use: :slugged

  validates :title, presence: true

  scope :published, -> { where(status: "published").where("published_at <= ?", Time.current) }
  scope :scheduled, -> { where(status: "scheduled").where("scheduled_for > ?", Time.current) }
  scope :recent, -> { order(published_at: :desc) }

  before_save :set_published_at, if: -> { status_changed? && status == "published" }
  after_update :create_revision!, if: -> { saved_change_to_content? || saved_change_to_title? }
  after_commit :fire_published_hook, on: [:create, :update], if: -> { saved_change_to_status? && status == "published" }

  # `content` is the *live* published array of block hashes:
  # [{ "type" => "paragraph", "data" => { "text" => "..." } }]. `draft_content` holds the
  # editor's in-progress work and is only committed to `content` by an explicit publish/update —
  # see `publish_draft!`. This is the WordPress model: typing/autosave never touches the
  # live page; publishing is a deliberate action.
  def content_blocks
    content || []
  end

  # What the editor should show: the in-progress draft if one exists, else the live content.
  def editing_blocks
    draft_content || content || []
  end

  # Rough reading time based on visible text (~200 wpm).
  def reading_time
    text = content_blocks.map { |b| b.dig("data", "text").to_s }.join(" ")
    words = text.scan(/\S+/).size
    minutes = (words / 200.0).ceil
    minutes < 1 ? 1 : minutes
  end

  # Featured image URL: explicit featured_image (media library) or the first image block.
  def featured_image_url
    featured_image&.url || content_blocks.find { |b| b["type"] == "image" }&.dig("data", "url")
  end

  # Commit the working copy to the live content and publish. Creating a revision first captures
  # the previously-published version so the change is reversible.
  def publish_draft!
    with_lock do
      @skip_revision = true
      revisions.create!(user: Current.user || author, title_snapshot: title, content_snapshot: content || [])
      update!(content: draft_content || [], draft_content: nil, status: "published")
    ensure
      @skip_revision = false
    end
  end

  # The editor submits `content` as a JSON string; jsonb columns don't auto-parse a string
  # (they store it as a JSON string, double-encoding it). Accept both array and string forms.
  # Applied to both `content` and `draft_content` via a shared coercion.
  def content=(value)
    super(parse_json_value(value))
  end

  def draft_content=(value)
    super(parse_json_value(value))
  end

  def should_generate_new_friendly_id?
    slug.blank? || title_changed?
  end

  private

  def parse_json_value(value)
    return value unless value.is_a?(String)
    JSON.parse(value)
  rescue JSON::ParserError
    value
  end

  def set_published_at
    self.published_at ||= Time.current
  end

  def create_revision!
    return if @skip_revision
    revisions.create!(user: Current.user || author, title_snapshot: title_before_last_save || title, content_snapshot: content_before_last_save || content)
  end

  def fire_published_hook
    Inkwell::Hooks.fire(:post_published, self)
  end
end
