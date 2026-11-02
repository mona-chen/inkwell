require "net/http"
require "openssl"
require "base64"

module GithubApps
  class Client
    class Error < StandardError; end
    attr_reader :connection
    def initialize(connection = nil)
      @connection = connection
    end

    def convert_manifest(code)
      raise Error, "Invalid GitHub registration code" unless code.to_s.match?(/\A[a-zA-Z0-9_-]{1,200}\z/)
      request("/app-manifests/#{code}/conversions", method: :post)
    end

    def app_jwt
      raise Error, "GitHub App access is no longer authorized" unless connection&.authorized?
      encode = ->(data) { Base64.urlsafe_encode64(data, padding: false) }
      header = encode.call({ alg: "RS256", typ: "JWT" }.to_json)
      payload = encode.call({ iat: Time.current.to_i - 60, exp: 9.minutes.from_now.to_i, iss: connection.app_id.to_s }.to_json)
      content = "#{header}.#{payload}"
      key = OpenSSL::PKey::RSA.new(connection.app_credentials.fetch("pem"))
      "#{content}.#{encode.call(key.sign(OpenSSL::Digest::SHA256.new, content))}"
    end

    def installation_token
      raise Error, "Install or reconnect the GitHub App first" unless connection&.connected?
      data = request("/app/installations/#{connection.installation_id}/access_tokens", method: :post, token: app_jwt, body: { permissions: { contents: "read", metadata: "read" } })
      raise Error, "GitHub did not issue an installation token" if data["token"].blank?
      data.fetch("token")
    end

    def exchange_user_code(code)
      request("/login/oauth/access_token", origin: "https://github.com", method: :post, form: true, body: { client_id: connection.client_id, client_secret: connection.app_credentials.fetch("client_secret"), code: code, redirect_uri: "#{connection.public_url}/admin/github_connection/authorize" }).fetch("access_token") { raise Error, "GitHub authorization failed; reconnect the account" }
    end

    def verify_installation!(user_token, installation_id)
      installation = nil
      10.times do |index|
        data = request("/user/installations?per_page=100&page=#{index + 1}", token: user_token)
        list = data.fetch("installations", [])
        installation = list.find { |item| item["id"].to_s == installation_id.to_s && item["app_id"].to_s == connection.app_id.to_s }
        break if installation || list.size < 100
      end
      raise Error, "This installation is not accessible to the authorizing GitHub account" unless installation
      actual = request("/app/installations/#{Integer(installation_id)}", token: app_jwt)
      raise Error, "Installation belongs to a different GitHub App" unless actual["app_id"].to_s == connection.app_id.to_s
      raise Error, "Installation is suspended" if actual["suspended_at"].present?
      actual
    end

    def repositories
      token = installation_token
      result = []
      10.times do |index|
        data = request("/installation/repositories?per_page=100&page=#{index + 1}", token: token)
        list = data.fetch("repositories", [])
        result.concat(list.map { |repo| repo.slice("id", "full_name", "default_branch", "private") })
        return result.sort_by { |repo| repo["full_name"].downcase } if list.size < 100
      end
      raise Error, "Select fewer than 1,000 repositories in the GitHub App installation"
    end

    private

    def request(path, method: :get, body: nil, token: nil, origin: "https://api.github.com", form: false)
      uri = URI.parse("#{origin}#{path}")
      request = (method == :post ? Net::HTTP::Post : Net::HTTP::Get).new(uri)
      request["Accept"] = "application/json"
      request["User-Agent"] = "Inkwell-GitHub-App"
      request["Authorization"] = "Bearer #{token}" if token
      if form
        request.set_form_data(body)
      elsif body
        request["Content-Type"] = "application/json"
        request.body = body.to_json
      end
      text = +""
      Net::HTTP.start(uri.host, 443, use_ssl: true, open_timeout: 5, read_timeout: 20) do |http|
        http.request(request) do |response|
          raise Error, "GitHub request failed (HTTP #{response.code})" unless response.is_a?(Net::HTTPSuccess)
          response.read_body do |chunk|
            text << chunk
            raise Error, "GitHub response exceeds 2 MB" if text.bytesize > 2.megabytes
          end
        end
      end
      data = JSON.parse(text)
      raise Error, "GitHub returned an unexpected response" unless data.is_a?(Hash)
      data
    rescue JSON::ParserError, Timeout::Error, SocketError, IOError, SystemCallError, OpenSSL::SSL::SSLError => error
      raise Error, "GitHub connection failed (#{error.class.name})"
    end
  end
end
