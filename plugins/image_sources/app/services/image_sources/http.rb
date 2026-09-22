require "net/http"
require "json"
require "uri"
require "resolv"
require "ipaddr"

module ImageSources
  # The HTTP the adapters share. Nothing here trusts a provider: responses are size-capped,
  # redirects are bounded, timeouts are short because this runs inside a page-editor request,
  # and hosts are checked against the private address ranges — the search query ultimately
  # comes from a language model, so "fetch this URL" must never reach the local network.
  module Http
    class Error < StandardError; end

    MAX_BYTES = 12 * 1024 * 1024
    MAX_REDIRECTS = 3
    USER_AGENT = "Inkwell-ImageSources/1.0".freeze

    # Everything unroutable from the public internet, so a result can never be used to probe
    # the server's own network or a cloud metadata endpoint.
    PRIVATE_RANGES = %w[
      0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12
      192.0.0.0/24 192.0.2.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24
      ::1/128 fc00::/7 fe80::/10
    ].map { |range| IPAddr.new(range) }.freeze

    class << self
      def get_json(url, headers: {}, timeout: 15)
        response = get(url, headers: headers, timeout: timeout)
        JSON.parse(response.body.to_s)
      rescue JSON::ParserError
        raise Error, "The image provider returned something that was not JSON."
      end

      def get_bytes(url, headers: {}, timeout: 30, max_bytes: MAX_BYTES)
        response = get(url, headers: headers, timeout: timeout, max_bytes: max_bytes)
        {
          bytes: response.body.to_s,
          content_type: response["content-type"].to_s.split(";").first.to_s.strip
        }
      end

      private

      def get(url, headers:, timeout:, max_bytes: nil, redirects: MAX_REDIRECTS)
        uri = parse_public_uri(url)
        request = Net::HTTP::Get.new(uri)
        request["User-Agent"] = USER_AGENT
        headers.each { |name, value| request[name] = value }

        response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https",
                                   open_timeout: timeout, read_timeout: timeout) { |net| net.request(request) }

        case response
        when Net::HTTPSuccess
          body = response.body.to_s
          raise Error, "That picture is larger than #{max_bytes / 1024 / 1024}MB, so it was not saved." if max_bytes && body.bytesize > max_bytes

          response
        when Net::HTTPRedirection
          raise Error, "The image source redirected too many times." if redirects <= 0

          get(response["location"], headers: headers, timeout: timeout, max_bytes: max_bytes, redirects: redirects - 1)
        else
          raise Error, "The image provider answered with #{response.code}."
        end
      end

      def parse_public_uri(url)
        uri = URI.parse(url.to_s)
        raise Error, "Only http(s) image sources are supported." unless %w[http https].include?(uri.scheme)
        raise Error, "That image source has no host." if uri.host.blank?

        addresses = Resolv.getaddresses(uri.host)
        raise Error, "That image source could not be resolved." if addresses.empty?

        addresses.each do |address|
          ip = begin
            IPAddr.new(address)
          rescue IPAddr::Error
            next
          end
          raise Error, "That image source is not reachable from here." if PRIVATE_RANGES.any? { |range| range.include?(ip) }
        end

        uri
      rescue URI::InvalidURIError
        raise Error, "That image source is not a usable URL."
      end
    end
  end
end
