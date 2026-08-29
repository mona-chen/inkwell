# frozen_string_literal: true

require "net/http"
require "json"
require "digest"

module MetaCapi
  # Sends server-side events to Meta's Conversions API (CAPI) endpoint.
  # Uses the Graph API v19.0 endpoint: POST /<pixel_id>/events
  #
  # https://developers.facebook.com/docs/marketing-api/conversions-api
  class Client
    BASE_URL = "https://graph.facebook.com/v19.0"

    # Check if a site has Meta CAPI configured (pixel ID + access token present)
    def self.configured?(site_id:)
      site = Site.find_by(id: site_id)
      return false unless site

      site.setting("meta_pixel_id").present? && site.setting("meta_access_token").present?
    end

    def initialize(site_id:)
      @site = Site.find(site_id)
      @pixel_id = @site.setting("meta_pixel_id")
      @access_token = @site.setting("meta_access_token")
      @test_event_code = @site.setting("meta_test_event_code")
    end

    # Send a single event to Meta's Conversions API.
    #
    #   client.send_event(
    #     event_name: "Purchase",
    #     user_data: { email: "test@example.com", client_ip_address: "1.2.3.4", client_user_agent: "..." },
    #     custom_data: { value: 29.99, currency: "USD" },
    #     event_source_url: "https://example.com/thank-you"
    #   )
    def send_event(event_name:, user_data: {}, custom_data: {}, event_source_url: nil, event_id: nil)
      payload = build_payload(event_name, user_data, custom_data, event_source_url, event_id)

      uri = URI("#{BASE_URL}/#{@pixel_id}/events")
      uri.query = URI.encode_www_form(access_token: @access_token)

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.read_timeout = 10
      http.open_timeout = 5

      request = Net::HTTP::Post.new(uri)
      request["Content-Type"] = "application/json"
      request.body = payload.to_json

      response = http.request(request)

      result = JSON.parse(response.body)
      if response.is_a?(Net::HTTPSuccess)
        Rails.logger.info("[MetaCAPI] Event `#{event_name}` sent successfully: #{result["events_received"]} events received")
        result
      else
        Rails.logger.error("[MetaCAPI] Event `#{event_name}` failed: #{response.code} #{result}")
        { error: result, status: response.code.to_i }
      end
    rescue StandardError => e
      Rails.logger.error("[MetaCAPI] Event `#{event_name}` exception: #{e.class}: #{e.message}")
      { error: e.message }
    end

    private

    def build_payload(event_name, user_data, custom_data, event_source_url, event_id)
      now = Time.current
      payload = {
        data: [
          {
            event_name: event_name,
            event_time: now.to_i,
            event_id: event_id || SecureRandom.uuid,
            action_source: "website",
            user_data: build_user_data(user_data),
            custom_data: custom_data.presence || {}
          }
        ]
      }

      payload[:data].first[:event_source_url] = event_source_url if event_source_url.present?
      payload[:test_event_code] = @test_event_code if @test_event_code.present?

      payload
    end

    def build_user_data(user_data)
      # Meta requires these fields for matching
      data = {
        client_ip_address: user_data[:client_ip_address],
        client_user_agent: user_data[:client_user_agent]
      }

      # Hash (SHA-256) any PII fields Meta expects to be hashed
      data[:em] = hash_value(user_data[:email]) if user_data[:email].present?
      data[:ph] = hash_value(user_data[:phone]) if user_data[:phone].present?
      data[:fn] = hash_value(user_data[:first_name]) if user_data[:first_name].present?
      data[:ln] = hash_value(user_data[:last_name]) if user_data[:last_name].present?
      data[:ct] = hash_value(user_data[:city]) if user_data[:city].present?
      data[:st] = hash_value(user_data[:state]) if user_data[:state].present?
      data[:zp] = hash_value(user_data[:zip]) if user_data[:zip].present?
      data[:country] = hash_value(user_data[:country]) if user_data[:country].present?
      data[:external_id] = hash_value(user_data[:external_id]) if user_data[:external_id].present?

      data.compact
    end

    def hash_value(value)
      Digest::SHA256.hexdigest(value.to_s.strip.downcase)
    end
  end
end
