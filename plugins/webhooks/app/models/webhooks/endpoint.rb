module Webhooks
  # A per-site destination that receives signed HTTP callbacks for subscribed events.
  class Endpoint < ApplicationRecord
    self.table_name = "webhook_endpoints"

    EVENT_NAMES = %w[
      post_published post_updated page_published
      comment_moderated contact_form_submitted newsletter_subscribed
    ].freeze

    belongs_to :site
    has_many :deliveries, class_name: "Webhooks::Delivery", foreign_key: :webhook_endpoint_id, dependent: :destroy

    validates :name, :url, presence: true
    validates :url, format: { with: %r{\Ahttps?://}, message: "must start with http:// or https://" }
    validate :events_must_be_known

    before_validation :generate_secret, on: :create

    scope :active, -> { where(active: true) }

    def subscribes_to?(event)
      events.include?(event.to_s)
    end

    def masked_secret
      return "" if secret.blank?

      "#{secret[0, 6]}…"
    end

    private

    def generate_secret
      self.secret ||= SecureRandom.hex(24)
    end

    def events_must_be_known
      unknown = Array(events) - EVENT_NAMES
      errors.add(:events, "contains unknown events: #{unknown.join(', ')}") if unknown.any?
    end
  end
end
