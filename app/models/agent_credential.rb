class AgentCredential < ApplicationRecord
  SCOPES = %w[site:read content:write content:publish builder:write plugins:read plugins:deploy settings:write].freeze
  SCOPE_DETAILS = {
    "site:read" => ["Read site content", "Inspect pages, drafts, SEO and public site configuration."],
    "content:write" => ["Create and edit drafts", "Create posts and pages; update content and metadata."],
    "content:publish" => ["Publish content", "Make reviewed drafts and metadata changes live."],
    "builder:write" => ["Edit visual designs", "Change native Builder layers in shared drafts."],
    "plugins:read" => ["Inspect plugins", "Read installed plugins and their public configuration."],
    "plugins:deploy" => ["Deploy frontend plugins", "Activate CSS/JavaScript releases on the public site."],
    "settings:write" => ["Change public site settings", "Edit site-wide scripts, CSS, theme defaults and plugin settings."]
  }.freeze
  belongs_to :site
  belongs_to :user
  validates :name, :token_digest, :token_prefix, :expires_at, presence: true
  validates :name, length: { maximum: 100 }
  validate { errors.add(:scopes, "contains unknown permissions") unless scopes.is_a?(Array) && (scopes - SCOPES).empty? }

  def self.issue!(site:, user:, name:, scopes:)
    secret = "ink_agent_#{SecureRandom.urlsafe_base64(32)}"
    credential = create!(site: site, user: user, name: name, scopes: scopes, token_digest: Digest::SHA256.hexdigest(secret), token_prefix: secret.first(18), expires_at: 90.days.from_now)
    [credential, secret]
  end

  def usable?
    revoked_at.nil? && expires_at > Time.current && !user.deactivated? &&
      (user.admin? || user.can?(:manage_site)) && (user.admin? || user.manages_site?(site))
  end

  def allows?(scope)
    scopes.include?(scope)
  end
end
