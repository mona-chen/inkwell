class User < ApplicationRecord
  devise :database_authenticatable, :registerable, :recoverable, :rememberable, :trackable, :validatable

  belongs_to :site
  has_many :theme_repository_sources, dependent: :destroy
  has_many :github_app_connections, dependent: :restrict_with_error
  belongs_to :role
  has_many :agent_credentials, dependent: :destroy
  has_many :posts, foreign_key: :author_id, dependent: :nullify
  has_many :pages, foreign_key: :author_id, dependent: :nullify
  has_many :comments, dependent: :nullify
  has_many :website_imports, dependent: :nullify

  # Multisite: a user may hold granted roles on other sites (super-admins manage the fleet).
  has_many :user_sites, class_name: "Multisite::UserSite", dependent: :destroy
  has_many :accessible_sites, through: :user_sites, source: :site

  belongs_to :avatar_item, class_name: "MediaItem", optional: true

  PROFILE_LINK_KINDS = %w[website x linkedin github instagram youtube tiktok email other].freeze
  PROFILE_LINK_LABELS = { "website" => "Website", "x" => "X", "linkedin" => "LinkedIn", "github" => "GitHub", "instagram" => "Instagram", "youtube" => "YouTube", "tiktok" => "TikTok", "email" => "Email", "other" => "Link" }.freeze
  MAX_PROFILE_LINKS = 8

  validates :name, presence: true, length: { maximum: 120 }
  validates :job_title, length: { maximum: 120 }
  validates :bio, length: { maximum: 2000 }
  validate :profile_links_are_safe
  validate :avatar_item_belongs_to_site

  before_validation :normalize_profile_links

  # The avatar shown publicly: a media-library upload wins over a pasted URL.
  def avatar_display_url
    avatar_item&.url.presence || avatar_url.presence
  end

  # [{ "kind" => "linkedin", "label" => "LinkedIn", "url" => "https://…" }, …]
  def profile_links
    Array(super).select { |link| link.is_a?(Hash) }
  end

  def initials
    name.to_s.split.first(2).map { |part| part[0] }.join.upcase.presence || "?"
  end

  scope :active, -> { where(deactivated_at: nil) }

  # Multisite-scoped sign-in: a user authenticates against their own site first; other
  # sites only accept them if they hold a granted role there (or are a super-admin). With
  # the plugin absent this is a plain global email lookup — identical to Devise's default.
  def self.find_for_database_authentication(warden_conditions)
    conditions = warden_conditions.dup
    email = conditions[:email].to_s.strip.downcase
    return nil if email.blank?

    user = find_by(email: email)
    return user unless user && defined?(Multisite::UserSite)

    # Super-admins can always authenticate, even when Current.site is nil (e.g. fresh install).
    return user if user&.super_admin?

    return nil if Current.site.nil?

    user if user.accessible_sites.exists?(id: Current.site.id)
  end

  # Platform super-admin: the global admin role. Per-site owners (UserSite role "admin")
  # are NOT platform super-admins — they scope to their own sites via #manages_site?.
  def super_admin?
    admin?
  end

  # Site ids this user may access via the switcher: their primary site plus any grants,
  # or every site for super-admins.
  def accessible_site_ids
    return Site.pluck(:id) if super_admin?

    ([ site_id ] + user_sites.pluck(:site_id)).compact.uniq
  end

  def accessible_sites
    Site.active.where(id: accessible_site_ids).order(:name)
  end

  def manages_site?(site)
    site_id == site.id || user_sites.exists?(site: site, role: "admin")
  end

  # Deactivated accounts can't sign in or receive reset instructions.
  def active_for_authentication?
    super && deactivated_at.nil?
  end

  def inactive_message
    deactivated_at ? :deactivated : super
  end

  def deactivated?
    deactivated_at.present?
  end

  def deactivate!
    update_column(:deactivated_at, Time.current)
  end

  def reactivate!
    update_column(:deactivated_at, nil)
  end

  # Author pages use name-parameterized URLs (/authors/maya-okafor).
  def to_param
    name.to_s.parameterize
  end

  delegate :can?, to: :role

  private

  def normalize_profile_links
    links = Array(self[:profile_links]).filter_map do |link|
      link = link.to_h.stringify_keys.slice("kind", "label", "url").transform_values { |value| value.to_s.strip }
      next if link["url"].blank?

      link["url"] = "https://#{link['url']}" unless link["url"].match?(%r{\A[a-z][a-z0-9+.-]*:}i)
      link["kind"] = PROFILE_LINK_KINDS.include?(link["kind"]) ? link["kind"] : self.class.link_kind_for(link["url"])
      link["label"] = link["label"].presence || PROFILE_LINK_LABELS.fetch(link["kind"], "Link")
      link
    end
    self[:profile_links] = links.first(MAX_PROFILE_LINKS)
  end

  def self.link_kind_for(url)
    host = (URI.parse(url).host.to_s.downcase.sub(/\Awww\./, "") rescue "")
    return "email" if url.start_with?("mailto:")
    { "x.com" => "x", "twitter.com" => "x", "linkedin.com" => "linkedin", "github.com" => "github", "instagram.com" => "instagram", "youtube.com" => "youtube", "tiktok.com" => "tiktok" }.fetch(host, "website")
  end

  def profile_links_are_safe
    profile_links.each do |link|
      next if link["url"].to_s.match?(%r{\A(?:https?://[^\s]+|mailto:[^\s@]+@[^\s@]+)\z}i)
      errors.add(:profile_links, "must be http(s) or mailto links (#{link['url'].to_s.truncate(40)})")
    end
  end

  def avatar_item_belongs_to_site
    return unless avatar_item
    errors.add(:avatar_item, "must be an image from this site's media library") unless avatar_item.site_id == site_id && avatar_item.image?
  end

  public

  def admin?
    role.name == "admin"
  end
end
