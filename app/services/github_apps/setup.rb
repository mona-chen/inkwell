module GithubApps
  module Setup
    module_function
    def public_url(request_url)
      value = ENV["INKWELL_PUBLIC_URL"].presence || request_url
      uri = URI.parse(value)
      return unless uri.scheme == "https" && uri.host.present? && uri.userinfo.nil? && uri.query.nil? && uri.fragment.nil? && ["", "/"].include?(uri.path)
      return if %w[localhost 127.0.0.1 ::1].include?(uri.host)
      value.delete_suffix("/")
    rescue URI::InvalidURIError
      nil
    end
  end
end
