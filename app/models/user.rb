class User < ApplicationRecord
  devise :database_authenticatable, :registerable, :recoverable, :rememberable, :trackable, :validatable

  belongs_to :site
  belongs_to :role
  has_many :posts, foreign_key: :author_id, dependent: :nullify
  has_many :pages, foreign_key: :author_id, dependent: :nullify
  has_many :comments, dependent: :nullify
  has_many :website_imports, dependent: :nullify

  # Multisite: a user may hold granted roles on other sites (super-admins manage the fleet).
  has_many :user_sites, class_name: "Multisite::UserSite", dependent: :destroy
  has_many :accessible_sites, through: :user_sites, source: :site

  validates :name, presence: true

  scope :active, -> { where(deactivated_at: nil) }

  # Multisite-scoped sign-in: a user authenticates against their own site first; other
  # sites only accept them if they hold a granted role there (or are a super-admin). With
  # the plugin absent this is a plain global email lookup — identical to Devise's default.
  def self.find_for_database_authentication(warden_conditions)
    conditions = warden_conditions.dup
    email = conditions[:email].to_s.strip.downcase
    return nil if email.blank?

    user = find_by(email: email)
    return user unless defined?(Multisite::UserSite)

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

  def admin?
    role.name == "admin"
  end
end
