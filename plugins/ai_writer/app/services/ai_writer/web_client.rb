require "net/http"
require "json"
require "uri"
require "resolv"
require "ipaddr"
require "cgi"

module AiWriter
  # The Copilot's view of the open web: read one page, or search for pages about a topic.
  #
  # Two rules shape this class. First, nothing here trusts the model: the URL being fetched and
  # the query being searched both come from a language model, so every host is checked against
  # the private address ranges before a socket is opened, responses are size-capped, redirects
  # are bounded, and timeouts are short — "fetch this URL" must never become a probe of the
  # server's own network or a cloud metadata endpoint. Second, reading a page needs no key while
  # searching needs one, so the two capabilities are configured and advertised separately: a
  # site with no search key still gets a working fetch tool, and a site with no search provider
  # is never sold a tool the server cannot fulfil.
  #
  # Results are research context for the model — never canvas content. A fetched page is reduced
  # to readable text and a title; a search returns titles, links and snippets. Nothing here ever
  # writes a foreign URL into a design.
  class WebClient
    class Error < StandardError; end

    MAX_BYTES = 4 * 1024 * 1024
    MAX_REDIRECTS = 4
    MAX_TEXT = 8000
    MAX_RESULTS = 8
    DEFAULT_RESULTS = 5
    FETCH_TIMEOUT = 15
    SEARCH_TIMEOUT = 20
    USER_AGENT = "Inkwell-Copilot/1.0 (web research; +https://inkwell.dev)".freeze
    CACHE_TTL = 10 * 60
    CACHE_LIMIT = 60

    # Everything unroutable from the public internet. Same guard as the image sources: a fetched
    # URL can never be used to probe the server's own network or a cloud metadata endpoint.
    PRIVATE_RANGES = %w[
      0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12
      192.0.0.0/24 192.0.2.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24
      ::1/128 fc00::/7 fe80::/10
    ].map { |range| IPAddr.new(range) }.freeze

    # The search providers this site can use. Each one is named only here and in the settings
    # select, so adding a provider is one entry plus one method.
    PROVIDERS = %w[brave tavily serper exa searxng].freeze
    PROVIDER_LABELS = {
      "brave" => "Brave Search",
      "tavily" => "Tavily",
      "serper" => "Serper (Google)",
      "exa" => "Exa",
      "searxng" => "SearXNG (self-hosted, no key)"
    }.freeze
    PROVIDER_ENV_KEYS = {
      "brave" => %w[BRAVE_SEARCH_API_KEY BRAVE_API_KEY],
      "tavily" => %w[TAVILY_API_KEY],
      "serper" => %w[SERPER_API_KEY],
      "exa" => %w[EXA_API_KEY]
    }.freeze

    class << self
      def provider_label(key) = PROVIDER_LABELS[key.to_s]

      # What this site can do with the web, in the shape the Copilot's config seam expects. One
      # place decides it, so the template, the settings page and the tests cannot disagree — and a
      # capability the server cannot serve is simply absent, which is what keeps an unfulfillable
      # tool out of the model's tool list.
      def capabilities(site)
        client = new(site: site)
        caps = {}
        caps[:webFetchUrl] = AiWriter::Engine.routes.url_helpers.web_path if client.fetch_enabled?
        if client.search_configured?
          caps[:webSearchUrl] = AiWriter::Engine.routes.url_helpers.web_path
          caps[:webSearchProvider] = provider_label(client.provider)
        end
        caps
      end

      # A tiny in-process cache so a model that re-reads the same page in a follow-up round does
      # not re-fetch it. Bounded and TTL'd, never shared across sites' process boundaries.
      def cache
        @cache ||= {}
      end

      def cache_read(key)
        entry = cache[key]
        return nil unless entry
        return (cache.delete(key) && nil) if entry[:expires_at] <= Time.now

        entry[:value]
      end

      def cache_write(key, value)
        cache.shift while cache.size >= CACHE_LIMIT
        cache[key] = { value: value, expires_at: Time.now + CACHE_TTL }
      end
    end

    def initialize(site:)
      @site = site
    end

    # Reading a page is keyless, so it is on unless the operator turned it off.
    def fetch_enabled?
      @site.setting("web_fetch_enabled").to_s != "0"
    end

    def search_configured?
      return searxng_base_url.present? if provider == "searxng"

      provider.present? && api_key.present?
    end

    def provider
      raw = (@site.setting("web_search_provider").presence || ENV["WEB_SEARCH_PROVIDER"].presence).to_s.strip
      # Naming a self-hosted base URL is itself the answer: a site running its own SearXNG should
      # not also have to remember to select the provider.
      return "searxng" if raw.blank? && searxng_base_url.present?
      return nil if raw.blank? || raw == "none"

      raw if PROVIDERS.include?(raw)
    end

    # The operator's own SearXNG (or the miyami LLM wrapper in front of one). This URL is NOT
    # passed through the private-address guard: it is operator-configured, not model-chosen, and a
    # self-hosted search engine normally lives on the same private network or host. The guard
    # exists for model-supplied URLs, which is exactly what #fetch handles.
    def searxng_base_url
      raw = (@site.setting("web_search_base_url").presence || ENV["SEARXNG_BASE_URL"].presence).to_s.strip
      raw.presence&.sub(%r{/+\z}, "")
    end

    def api_key
      key = PROVIDER_ENV_KEYS.fetch(provider.to_s, []).lazy.map { |name| ENV[name].presence }.find(&:present?)
      @site.setting("web_search_api_key").presence || key
    end

    # Read one public page and reduce it to a title plus readable text. Raises Error with a
    # message the model can act on — the reason is always the reason, never a generic failure.
    def fetch(url)
      raise Error, "Reading a page is switched off for this site." unless fetch_enabled?

      target = normalize_url(url)
      cached = self.class.cache_read(["fetch", target].join("\n"))
      return cached if cached

      final_uri, response = request(target, timeout: FETCH_TIMEOUT)
      result = extract(final_uri.to_s, response)
      self.class.cache_write(["fetch", target].join("\n"), result)
      result
    end

    # Search the web and return titles, links and snippets. The model's next move is usually to
    # fetch one of the links, which is why the shape is small and linkable rather than verbose.
    def search(query, limit: DEFAULT_RESULTS)
      raise Error, "Web search is not configured for this site." unless search_configured?
      raise Error, "web_search needs a query describing what to look up." if query.to_s.strip.blank?

      count = limit.to_i.clamp(1, MAX_RESULTS)
      results = send("search_#{provider}", query.to_s.strip, count)
      { "query" => query.to_s.strip, "provider" => provider, "count" => results.size, "results" => results }
    end

    # A cheap reachability check for Settings → Copilot: does the configured provider answer?
    def check
      return { ok: false, message: "No search provider is selected, so web search is unavailable." } unless provider.present?
      if provider == "searxng"
        return { ok: false, message: "No self-hosted search base URL is set." } if searxng_base_url.blank?
      elsif api_key.blank?
        return { ok: false, message: "No API key is stored for #{self.class.provider_label(provider)}." }
      end

      results = send("search_#{provider}", "web search", 1)
      label = self.class.provider_label(provider)
      message = if results.empty?
                  "#{label} answered, but returned no results for a test query."
                else
                  "#{label} answered — first result: #{results.first['url']}"
                end
      { ok: true, message: message }
    rescue Error => e
      { ok: false, message: e.message }
    end

    private

    def normalize_url(url)
      raw = url.to_s.strip
      return raw if raw.match?(%r{\Ahttps?://}i)

      raise Error, "fetch_web_page needs an http(s) URL." if raw.blank? || raw.match?(/\s/)

      # Something that already carries a foreign scheme (file:, ftp:, mailto:, data:) is a request
      # we do not serve. Saying so is clearer than prefixing https:// and reporting a DNS failure —
      # and a bare host:port is not a scheme, so it is left to be prefixed.
      if raw.match?(%r{\A[a-z][a-z0-9+.-]*:}i) && !raw.match?(%r{\A[a-z0-9.-]+:\d+}i)
        raise Error, "Only http(s) pages can be read."
      end

      "https://#{raw}"
    end

    def request(url, timeout:, redirects: MAX_REDIRECTS)
      uri = parse_public_uri(url)
      request = Net::HTTP::Get.new(uri)
      request["User-Agent"] = USER_AGENT
      request["Accept"] = "text/html,application/xhtml+xml,application/json;q=0.8,text/plain;q=0.7,*/*;q=0.5"
      request["Accept-Language"] = "en"

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https",
                                 open_timeout: timeout, read_timeout: timeout) { |net| net.request(request) }

      case response
      when Net::HTTPSuccess
        body = response.body.to_s
        raise Error, "That page is larger than #{MAX_BYTES / 1024 / 1024}MB, so it was not read." if body.bytesize > MAX_BYTES

        [ uri, response ]
      when Net::HTTPRedirection
        raise Error, "That page redirected too many times." if redirects <= 0

        request(URI.join(uri.to_s, response["location"].to_s).to_s, timeout: timeout, redirects: redirects - 1)
      else
        raise Error, "That page answered with #{response.code}."
      end
    end

    def extract(url, response)
      body = response.body.to_s
      content_type = response["content-type"].to_s.downcase
      final_url = url

      if content_type.include?("html") || (content_type.blank? && body.lstrip.start_with?("<"))
        html_extract(final_url, body)
      else
        { "url" => final_url, "content_type" => content_type.split(";").first, "title" => nil,
          "text" => clamp(body), "truncated" => body.length > MAX_TEXT }
      end
    end

    def html_extract(url, html)
      doc = Nokogiri::HTML(html)
      doc.css("script, style, noscript, template, svg, iframe, form, nav, footer, aside").remove
      title = doc.at_css("title")&.text.to_s.strip.presence
      text = doc.at_css("body")&.text.to_s
      text = collapse(text)
      { "url" => url, "content_type" => "text/html", "title" => title&.truncate(200),
        "text" => clamp(text), "truncated" => text.length > MAX_TEXT }
    end

    def collapse(text)
      text.to_s.gsub(/\r/, "").gsub(/[ \t\f\v]+/, " ").gsub(/\n\s*\n\s*\n+/, "\n\n").strip
    end

    def clamp(text)
      text.to_s[0, MAX_TEXT].to_s
    end

    def parse_public_uri(url)
      uri = URI.parse(url.to_s)
      raise Error, "Only http(s) pages can be read." unless %w[http https].include?(uri.scheme)
      raise Error, "That page URL has no host." if uri.host.blank?

      addresses = Resolv.getaddresses(uri.host)
      raise Error, "That page's host could not be resolved." if addresses.empty?

      addresses.each do |address|
        ip = begin
          IPAddr.new(address)
        rescue IPAddr::Error
          next
        end
        raise Error, "That page is not reachable from here." if PRIVATE_RANGES.any? { |range| range.include?(ip) }
      end

      uri
    rescue URI::InvalidURIError
      raise Error, "That page URL is not usable."
    end

    def get_json(url, headers: {}, timeout: SEARCH_TIMEOUT)
      uri = URI.parse(url)
      request = Net::HTTP::Get.new(uri)
      request["User-Agent"] = USER_AGENT
      headers.each { |name, value| request[name] = value }

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: timeout, read_timeout: timeout) { |net| net.request(request) }
      parse_provider_response(uri, response)
    end

    def post_json(url, headers: {}, body: {}, timeout: SEARCH_TIMEOUT)
      uri = URI.parse(url)
      request = Net::HTTP::Post.new(uri.request_uri)
      request["User-Agent"] = USER_AGENT
      request["Content-Type"] = "application/json"
      request["Accept"] = "application/json"
      headers.each { |name, value| request[name] = value }
      request.body = body.to_json

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: timeout, read_timeout: timeout) { |net| net.request(request) }
      parse_provider_response(uri, response)
    end

    def parse_provider_response(uri, response)
      unless response.is_a?(Net::HTTPSuccess)
        raise Error, "The search provider answered with #{response.code}#{provider_detail(response)}."
      end

      JSON.parse(response.body.to_s)
    rescue JSON::ParserError
      raise Error, "The search provider returned something that was not JSON."
    end

    # A provider's own refusal names the fix ("Invalid API key", "quota exceeded"). Relaying the
    # raw body buries that sentence, so lift just the message.
    def provider_detail(response)
      parsed = JSON.parse(response.body.to_s) rescue nil
      message = parsed.is_a?(Hash) ? (parsed.dig("error", "message") || parsed["error"] || parsed["message"] || parsed.dig("detail", "message")) : nil
      message = parsed["detail"] if message.blank? && parsed.is_a?(Hash) && parsed["detail"].is_a?(String)
      message.present? ? ": #{message.to_s[0, 200]}" : ""
    end

    def search_brave(query, count)
      data = get_json(
        "https://api.search.brave.com/res/v1/web/search?q=#{CGI.escape(query)}&count=#{count}",
        headers: { "X-Subscription-Token" => api_key, "Accept" => "application/json" }
      )
      Array(data.dig("web", "results")).first(count).map do |result|
        { "title" => result["title"].to_s, "url" => result["url"].to_s, "snippet" => strip_html(result["description"]) }
      end
    end

    def search_tavily(query, count)
      data = post_json(
        "https://api.tavily.com/search",
        headers: { "Authorization" => "Bearer #{api_key}" },
        body: { "query" => query, "max_results" => count, "search_depth" => "basic", "include_answer" => false }
      )
      Array(data["results"]).first(count).map do |result|
        { "title" => result["title"].to_s, "url" => result["url"].to_s, "snippet" => result["content"].to_s[0, 400] }
      end
    end

    def search_serper(query, count)
      data = post_json(
        "https://google.serper.dev/search",
        headers: { "X-API-KEY" => api_key },
        body: { "q" => query, "num" => count }
      )
      Array(data["organic"]).first(count).map do |result|
        { "title" => result["title"].to_s, "url" => result["link"].to_s, "snippet" => result["snippet"].to_s }
      end
    end

    def search_exa(query, count)
      data = post_json(
        "https://api.exa.ai/search",
        headers: { "x-api-key" => api_key },
        body: { "query" => query, "numResults" => count, "type" => "auto", "contents" => { "text" => { "maxCharacters" => 400 } } }
      )
      Array(data["results"]).first(count).map do |result|
        { "title" => result["title"].to_s, "url" => result["url"].to_s, "snippet" => result["text"].to_s[0, 400] }
      end
    end

    # A SearXNG instance, called through the LLM-friendly FastAPI wrapper when it is present
    # (/search-api, as shipped by the miyami wrapper) and falling back to SearXNG's own JSON API
    # (/search?format=json). Both answer with the same { title, url, content } shape, so one
    # mapping covers a bare SearXNG and a wrapper in front of it. No key: this is the
    # no-signup path for a site that would rather self-host than pay a search provider.
    def search_searxng(query, count)
      base = searxng_base_url
      raise Error, "No self-hosted search base URL is set." if base.blank?

      data = searxng_get("#{base}/search-api", { "query" => query, "categories" => "general" }) ||
             searxng_get("#{base}/search", { "q" => query, "format" => "json", "categories" => "general" })
      raise Error, "The self-hosted search engine did not answer. Check that it is running at #{base}." if data.nil?

      Array(data["results"]).first(count).map do |result|
        { "title" => result["title"].to_s, "url" => result["url"].to_s, "snippet" => result["content"].to_s[0, 400] }
      end
    end

    # nil means "this path is not served here", so the caller can try the other shape; a real
    # transport failure raises with the reason.
    def searxng_get(url, params)
      uri = URI.parse(url)
      uri.query = URI.encode_www_form(params)
      request = Net::HTTP::Get.new(uri.request_uri)
      request["User-Agent"] = USER_AGENT
      request["Accept"] = "application/json"

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https",
                                 open_timeout: SEARCH_TIMEOUT, read_timeout: SEARCH_TIMEOUT) { |net| net.request(request) }
      return nil if response.is_a?(Net::HTTPNotFound)

      unless response.is_a?(Net::HTTPSuccess)
        raise Error, "The self-hosted search engine answered with #{response.code}#{provider_detail(response)}."
      end

      JSON.parse(response.body.to_s)
    rescue JSON::ParserError
      raise Error, "The self-hosted search engine returned something that was not JSON."
    rescue Errno::ECONNREFUSED, SocketError
      raise Error, "The self-hosted search engine is not reachable at #{url}. Start it, or clear the base URL."
    end

    def strip_html(value)
      Nokogiri::HTML(value.to_s).text.to_s.strip
    rescue StandardError
      value.to_s
    end
  end
end
