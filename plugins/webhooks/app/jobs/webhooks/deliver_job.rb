module Webhooks
  # Delivers one webhook and records the outcome. Retries with backoff on failure so a
  # temporarily unreachable receiver eventually gets the event.
  class DeliverJob < ApplicationJob
    queue_as :low

    retry_on StandardError, wait: :polynomially_longer, attempts: 5

    def perform(delivery_id)
      delivery = Webhooks::Delivery.includes(:endpoint).find(delivery_id)
      endpoint = delivery.endpoint
      return unless endpoint.active?

      delivery.update!(attempts: delivery.attempts + 1)
      result = Webhooks::Client.new.deliver(endpoint: endpoint, event: delivery.event, payload: delivery.payload)

      if result[:success]
        delivery.update!(response_code: result[:code], delivered_at: Time.current, error: nil)
      else
        delivery.update!(response_code: result[:code], error: result[:error] || "HTTP #{result[:code]}")
        raise DeliveryFailed, delivery.error
      end
    end

    class DeliveryFailed < StandardError; end
  end
end
