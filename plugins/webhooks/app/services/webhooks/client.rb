# frozen_string_literal: true

require "net/http"
require "json"
require "openssl"

module Webhooks
  # Delivers a signed JSON payload to an endpoint. The signature scheme is a Stripe-style
  # HMAC-SHA256 over "<unix_timestamp>.<raw_json_body>", hex-encoded and sent in
  # X-Inkwell-Signature (prefixed `sha256=`). Receivers should compare in constant time.
  class Client
    class DeliveryError < StandardError; end

    def self.sign(secret, timestamp, body)
      OpenSSL::HMAC.hexdigest("SHA256", secret.to_s, "#{timestamp}.#{body}")
    end

    def deliver(endpoint:, event:, payload:)
      body = {
        event: event.to_s,
        delivered_at: Time.current.iso8601,
        data: payload
      }.to_json
      timestamp = Time.current.to_i.to_s
      signature = self.class.sign(endpoint.secret, timestamp, body)

      uri = UrlGuard.uri!(endpoint.url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = 5
      http.read_timeout = 10

      request = Net::HTTP::Post.new(uri)
      request["Content-Type"] = "application/json"
      request["User-Agent"] = "Inkwell-Webhooks/1.0"
      request["X-Inkwell-Event"] = event.to_s
      request["X-Inkwell-Timestamp"] = timestamp
      request["X-Inkwell-Signature"] = "sha256=#{signature}"
      request.body = body

      response = http.request(request)
      {
        success: response.is_a?(Net::HTTPSuccess),
        code: response.code.to_i,
        body: response.body.to_s[0, 500]
      }
    rescue StandardError => e
      { success: false, code: nil, error: "#{e.class}: #{e.message}" }
    end
  end
end
