class Site < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :posts, dependent: :destroy
  has_many :pages, dependent: :destroy
  has_many :terms, dependent: :destroy
  has_many :menus, dependent: :destroy
  has_many :media_items, dependent: :destroy
  has_many :widgets, dependent: :destroy
  has_many :website_imports, dependent: :destroy
  has_many :options, dependent: :destroy

  # Added by the Multisite plugin (class_name strings stay lazy so a single-site install
  # never resolves the constant until a multisite feature is actually used).
  has_many :user_sites, class_name: "Multisite::UserSite", dependent: :destroy
  has_many :site_users, through: :user_sites, source: :user
  has_many :invitations, class_name: "Multisite::SiteInvitation", dependent: :destroy
  has_many :plugin_activations, class_name: "Multisite::SitePluginActivation", dependent: :destroy
  has_many :custom_domains, class_name: "Multisite::SiteCustomDomain", dependent: :destroy
  has_many :api_tokens, dependent: :destroy

  # Multisite columns (active/is_default/subdomain) exist after the plugin migration runs;
  # the scopes are safe to define unconditionally — they only touch the DB when called.
  scope :active, -> { where(active: true) }
  scope :default_site, -> { where(is_default: true) }

  validates :name, :domain, presence: true

  def setting(key, default = nil)
    options.find_by(key: key)&.value&.dig("value") || default
  end

  def set_setting!(key, value)
    options.find_or_initialize_by(key: key).update!(value: { "value" => value })
  end

  def builder_site_parts
    setting("builder_site_parts", {}).presence || {}
  end

  def set_builder_site_parts!(parts)
    allowed = parts.to_h.slice("header", "footer")
    set_setting!("builder_site_parts", allowed)
  end

  # Homepage configuration — mirrors WordPress "Settings → Reading".
  #   show_on_front: "posts" (latest posts) or "page" (a chosen static page)
  #   page_on_front: the Page id to render as the homepage when show_on_front is "page"
  def show_on_front
    setting("show_on_front", "posts")
  end

  def front_page
    id = setting("page_on_front")
    id.present? ? pages.find_by(id: id) : nil
  end

  def front_page?
    show_on_front == "page" && front_page.present?
  end

  # Durable setup progress derived from the site itself. There is no separate
  # onboarding flag to drift out of sync with the workspace's real state.
  def setup_checklist
    {
      identity: setting("tagline").present? || logo_item.present?,
      page: pages.exists?,
      homepage: options.exists?(key: "show_on_front"),
      navigation: menus.joins(:menu_items).exists?,
      publication: pages.published.exists? || posts.published.exists?
    }
  end

  # Site logo — the id of a MediaItem in the media library (set via Settings → General).
  def logo_item
    id = setting("site_logo")
    id.present? ? media_items.find_by(id: id) : nil
  end

  # --- Multisite (self-serve / admin-created sites) --------------------------------

  def super_admin?(user)
    user_sites.exists?(user: user, role: "admin")
  end

  # Returns the canonical public host for this site — the full domain when set
  # (subdomain sites store "#{subdomain}.#{base_domain}"), else the subdomain mount.
  def public_host
    domain.present? ? domain : "#{subdomain}.#{multisite_base_domain}".presence
  end

  def multisite_base_domain
    self.class.multisite_base_domain
  end

  # Canonical public URL for the site, used by dynamic content bindings such as
  # `{{ site.url }}`. Protocol-relative so it works on http and https.
  def url
    "//#{public_host}"
  end

  def self.multisite_base_domain
    ENV["INKWELL_BASE_DOMAIN"].presence ||
      (Rails.env.development? || Rails.env.test? ? "lvh.me" : "inkwell.app")
  end
end
