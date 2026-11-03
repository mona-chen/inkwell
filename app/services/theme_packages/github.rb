require "net/http"
require "tempfile"

module ThemePackages
  class Github
    HOSTS = %w[api.github.com codeload.github.com].freeze
    def initialize(repository, token: ENV["INKWELL_GITHUB_TOKEN"])
      raise Invalid, "Use a GitHub owner/repository name" unless repository.match?(%r{\A[a-zA-Z0-9][a-zA-Z0-9_.-]*/[a-zA-Z0-9][a-zA-Z0-9_.-]*\z})
      @repository, @token = repository, token
    end

    def head(branch)
      result = JSON.parse(request("https://api.github.com/repos/#{@repository}/commits/#{URI.encode_www_form_component(branch)}", limit: 2.megabytes))
      sha = result["sha"].to_s
      raise Invalid, "GitHub did not return a commit SHA" unless sha.match?(/\A[0-9a-f]{40,64}\z/)
      sha
    rescue JSON::ParserError
      raise Invalid, "GitHub returned invalid commit metadata"
    end

    def archive(sha)
      raise Invalid, "Invalid commit SHA" unless sha.match?(/\A[0-9a-f]{40,64}\z/)
      Tempfile.create(["inkwell-github", ".zip"]) do |file|
        file.binmode
        request("https://api.github.com/repos/#{@repository}/zipball/#{sha}", limit: Importer::MAX_BYTES, output: file)
        file.flush
        yield file.path
      end
    end

    private

    def request(address, limit:, output: nil, hops: 0)
      raise Invalid, "Too many GitHub archive redirects" if hops > 4
      uri = URI.parse(address)
      unless uri.scheme == "https" && HOSTS.include?(uri.host) && uri.port == 443 && uri.userinfo.nil?
        raise Invalid, "GitHub redirected outside its allowed download hosts"
      end
      headers = { "Accept" => "application/vnd.github+json", "User-Agent" => "Inkwell-Theme-Installer" }
      headers["Authorization"] = "Bearer #{@token}" if uri.host == "api.github.com" && @token.present?
      redirect = nil
      body = +""
      Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 30) do |http|
        http.request(Net::HTTP::Get.new(uri, headers)) do |response|
          if response.is_a?(Net::HTTPRedirection)
            redirect = URI.join(uri, response.fetch("location")).to_s
          elsif !response.is_a?(Net::HTTPSuccess)
            raise Invalid, "GitHub request failed (HTTP #{response.code}); check repository, branch, and token access"
          else
            bytes = 0
            response.read_body do |chunk|
              bytes += chunk.bytesize
              raise Invalid, "GitHub response exceeds download limits" if bytes > limit
              output ? output.write(chunk) : body << chunk
            end
          end
        end
      end
      redirect ? request(redirect, limit: limit, output: output, hops: hops + 1) : body
    rescue Timeout::Error, SocketError, IOError, SystemCallError, OpenSSL::SSL::SSLError => error
      raise Invalid, "GitHub download failed: #{error.class.name}"
    end
  end
end
