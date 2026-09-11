module Webhooks
  # Audit record for one delivery attempt set. `attempts` increments per try; `delivered_at`
  # is set on the first 2xx response. Failed deliveries retain the last error for debugging.
  class Delivery < ApplicationRecord
    self.table_name = "webhook_deliveries"

    belongs_to :endpoint, class_name: "Webhooks::Endpoint", foreign_key: :webhook_endpoint_id

    scope :recent, -> { order(created_at: :desc) }
    scope :successful, -> { where.not(delivered_at: nil) }

    def delivered? = delivered_at.present?
  end
end
