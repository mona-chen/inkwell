require "resolv"
require "ipaddr"

module Webhooks
  # Blocks webhook URLs that resolve to private, loopback, link-local, or reserved networks,
  # preventing the webhook sender from being used as an SSRF probe. Mirrors the guard used by
  # WebsiteImportJob.
  module UrlGuard
    PRIVATE_NETWORKS = %w[
      0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16
      172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 192.168.0.0/16 198.18.0.0/15
      198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4
      ::/128 ::1/128 fc00::/7 fe80::/10 ff00::/8
    ].map { |cidr| IPAddr.new(cidr) }.freeze

    class UnsafeDestination < StandardError; end

    def self.uri!(url)
      uri = begin
        URI.parse(url.to_s)
      rescue URI::InvalidURIError
        raise UnsafeDestination, "invalid webhook URL"
      end

      raise UnsafeDestination, "webhook URL must be http(s)" unless uri.is_a?(URI::HTTP) && uri.host.present?

      addresses = Resolv.getaddresses(uri.host)
      raise UnsafeDestination, "webhook host could not be resolved" if addresses.empty?

      if addresses.any? { |address| private_address?(address) }
        raise UnsafeDestination, "webhook URL resolves to a private or reserved address"
      end

      uri
    end

    def self.private_address?(address)
      ip = IPAddr.new(address)
      PRIVATE_NETWORKS.any? { |network| network.include?(ip) }
    rescue IPAddr::InvalidAddressError
      true
    end
  end
end
