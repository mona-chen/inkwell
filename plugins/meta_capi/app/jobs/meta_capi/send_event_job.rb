# frozen_string_literal: true

module MetaCapi
  # Sends a single event to Meta's Conversions API asynchronously.
  # Called by hooks in the engine when relevant actions occur.
  class SendEventJob < ApplicationJob
    queue_as :default

    # @param event_name [String] Meta event name (e.g. "ViewContent", "Purchase", "Lead")
    # @param site_id [Integer] The site this event belongs to (for pixel config lookup)
    # @param user_data [Hash] User data for matching (email, phone, client_ip_address, client_user_agent, etc.)
    # @param custom_data [Hash] Event-specific data (content_name, value, currency, etc.)
    # @param event_source_url [String, nil] The URL where the event occurred
    # @param event_id [String, nil] Unique event ID for deduplication
    def perform(event_name:, site_id:, user_data: {}, custom_data: {}, event_source_url: nil, event_id: nil)
      client = MetaCapi::Client.new(site_id: site_id)
      client.send_event(
        event_name: event_name,
        user_data: user_data,
        custom_data: custom_data,
        event_source_url: event_source_url,
        event_id: event_id
      )
    end
  end
end
