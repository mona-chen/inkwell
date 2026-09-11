module Multisite
  class SiteInvitation < ApplicationRecord
    self.table_name = "site_invitations"

    belongs_to :site

    before_validation :set_defaults, on: :create
    before_create :generate_token

    validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
    validates :email, uniqueness: { scope: :site_id, message: "already invited to this site" }
    validates :role, inclusion: { in: Multisite::UserSite::ROLES }
    validates :token, uniqueness: true, allow_nil: true

    scope :pending, -> { where(accepted_at: nil).where("expires_at > ?", Time.current) }
    scope :expired, -> { where("expires_at <= ?", Time.current) }

    def accept!
      update!(accepted_at: Time.current)
    end

    def expired?
      expires_at <= Time.current
    end

    def pending?
      accepted_at.nil? && !expired?
    end

    private

    def set_defaults
      self.expires_at ||= 7.days.from_now
    end

    def generate_token
      self.token = SecureRandom.urlsafe_base64(32)
    end
  end
end
