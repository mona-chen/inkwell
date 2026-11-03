class ThemeRoute < ApplicationRecord
  STATUSES = %w[draft published].freeze
  RESERVED_SEGMENTS = ThemePackages::Manifest::RESERVED

  belongs_to :site
  belongs_to :social_image, class_name: "MediaItem", optional: true
  has_many :revisions, -> { order(revision_number: :desc) }, class_name: "ThemeRouteRevision", dependent: :destroy

  validates :path, :route_key, :status, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :path, uniqueness: { scope: [ :site_id, :theme_release_id ] }
  validates :route_key, format: { with: /\A[a-z][a-z0-9_]*\z/ }
  validate :path_must_be_safe
  validate :social_image_belongs_to_site
  validate :schema_json_size

  before_validation :ensure_release
  before_validation :ensure_published_at, if: -> { status == "published" }
  before_update :capture_revision, if: :metadata_changing?
  after_update :bump_revision

  scope :published, -> { where(status: "published").where("published_at IS NULL OR published_at <= ?", Time.current) }
  scope :ordered, -> { order(:navigation_position, :path) }
  scope :sitemap, -> { published.where(sitemap: true) }

  def self.active_for(site)
    scope = where(site: site, theme_release_id: site.active_theme)
    manifest = ThemePackages::Runtime.for(site.active_theme)&.manifest
    manifest ? scope.where.not(path: manifest.routes.keys - manifest.canonical_routes.keys) : scope
  end

  def self.match(site:, path:, release: site.active_theme, preview: false)
    scope = where(site: site, theme_release_id: release)
    scope = scope.published unless preview
    scope.find_by(path: path) || scope.to_a.find { |route| route.match_path?(path) }
  end

  def self.route_key_for(path, manifest = {}, target = nil)
    templates = manifest.dig("inkwell", "templates") || {}
    basename = File.basename(target.to_s, ".*")
    key = templates.find { |_name, value| value == path || value == target || value == basename }&.first
    key ||= case path
    when "/" then "home"
    when "/blog" then "blog_index"
    when "/blog/:slug" then "blog_post"
    when "/authors/:slug" then "author"
    else path.to_s.delete_prefix("/").gsub(/[^a-z0-9]+/, "_")
    end
    result = key.to_s.gsub(/[^a-z0-9_]+/, "_").gsub(/\A_+|_+\z/, "")
    result = "not_found" if result == "404"
    result = "route_#{result}" unless result.match?(/\A[a-z]/)
    result.presence || "route"
  end

  def published?
    status == "published" && (published_at.nil? || published_at <= Time.current)
  end

  def display_title
    title_override.presence || draft_data["title"].presence || seo_title.presence || route_key.humanize
  end

  def match_path?(candidate)
    path.include?(":") && path_pattern.match?(candidate.to_s)
  end

  def path_params(candidate)
    return {} unless path.include?(":") && match_path?(candidate)

    names = path.scan(/:([a-z_]+)/).flatten
    values = candidate.to_s.match(path_pattern)&.captures || []
    names.zip(values).to_h
  end

  def seo_payload
    social = social_image
    title = seo_title.presence || title_override.presence
    description = meta_description.to_s
    data = schema_json.is_a?(Hash) ? schema_json : {}
    {
      "title" => title,
      "description" => description.presence,
      "canonical" => canonical_url.presence,
      "robots" => (robots.presence unless robots == "index, follow"),
      "og" => {
        "title" => data.dig("og", "title").presence || title,
        "description" => data.dig("og", "description").presence || description.presence,
        "image" => data.dig("og", "image").presence || social&.url
      }.compact,
      "twitter" => {
        "card" => data.dig("twitter", "card").presence || "summary_large_image",
        "title" => data.dig("twitter", "title").presence || title,
        "description" => data.dig("twitter", "description").presence || description.presence,
        "image" => data.dig("twitter", "image").presence || social&.url
      }.compact,
      "schema" => data["schema"].presence || (data["@context"] ? data.except("og", "twitter", "schema") : nil),
      "sitemap" => sitemap
    }.compact
  end

  def publish!
    update!(
      status: "published",
      published_at: published_at || Time.current,
      draft_data: {},
      revision: revision
    )
  end

  def unpublish!
    update!(status: "draft", published_at: nil)
  end

  def restore!(revision_record)
    snapshot = revision_record.snapshot
    assign_attributes(snapshot.slice(*revision_attributes))
    save!
  end

  def revision_attributes
    %w[path route_key title_override seo_title meta_description canonical_url social_image_id robots schema_json
       status draft_data published_at navigation_location navigation_label navigation_position sitemap]
  end

  private

  def ensure_release
    self.theme_release_id = site&.active_theme if theme_release_id.blank?
  end

  def ensure_published_at
    self.published_at ||= Time.current
  end

  def metadata_changing?
    (changed & revision_attributes).any? || draft_data_changed?
  end

  def capture_revision
    revisions.create!(
      revision_number: revisions.maximum(:revision_number).to_i + 1,
      snapshot: attributes_in_database.slice(*revision_attributes),
      user: Current.user
    )
  end

  def bump_revision
    update_column(:revision, revision + 1) if saved_change_to_revision? == false
  end

  def social_image_belongs_to_site
    return unless social_image && site

    errors.add(:social_image, "must belong to this site") if social_image.site_id != site_id
  end

  def schema_json_size
    errors.add(:schema_json, "is too large") if schema_json.to_json.bytesize > 64.kilobytes
  end

  def path_must_be_safe
    return if path.blank?

    unless path.start_with?("/") && !path.start_with?("//") && !path.match?(/[?#\\\s]/) &&
           !path.split("/").any? { |part| [ ".", ".." ].include?(part) } && !ThemePackages::Manifest.reserved_path?(path)
      errors.add(:path, "must be a safe, unreserved local path")
    end
  end

  def path_pattern
    Regexp.new("\\A#{Regexp.escape(path).gsub(/:([a-z_]+)/, '([^/]+)')}\\z")
  end
end
