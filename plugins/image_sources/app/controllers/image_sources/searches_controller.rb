module ImageSources
  # The one endpoint the browser calls. It is a proxy on purpose: provider keys and provider
  # rules stay on the server, and — more importantly — the answer is not a list of foreign URLs
  # but a list of this site's own media items, so the page it feeds is portable and every file
  # carries its licence and credit.
  #
  # Errors are per-provider: one library being down or rate-limited must not lose the results a
  # second library already returned.
  class SearchesController < Admin::BaseController
    DEFAULT_LIMIT = 4
    MAX_LIMIT = 8

    def index
      query = params[:q].to_s.strip
      if query.blank?
        return render json: { results: [], total: 0, error: "Describe what the picture should show." }, status: :unprocessable_entity
      end

      kind = params[:kind].to_s.strip.presence
      adapters = kind ? Registry.for_kind(Current.site, kind, color: params[:color]) : Registry.enabled(Current.site, color: params[:color])
      if adapters.empty?
        return render json: {
          results: [], total: 0,
          error: kind ? "No image source on this site provides “#{kind}”." : "No image sources are switched on for this site.",
          available_kinds: Registry.enabled(Current.site).map(&:kind).uniq
        }, status: :unprocessable_entity
      end

      items, errors = collect(adapters, query)
      render json: {
        query: query, kind: kind, results: items.map(&:library_json), total: items.size,
        errors: errors.presence, guidance: guidance(items, errors)
      }.compact
    end

    private

    def collect(adapters, query)
      items = []
      errors = []

      adapters.each do |adapter|
        adapter.search(query: query, limit: per_source_limit).each do |result|
          begin
            items << Sideload.call(adapter: adapter, result: result, site: Current.site, user: current_user)
          rescue StandardError => e
            errors << "#{adapter.label}: #{e.message}"
          end
        end
      rescue StandardError => e
        errors << "#{adapter.label}: #{e.message}"
      end

      [ items, errors.uniq ]
    end

    def per_source_limit
      params[:limit].to_i.clamp(1, MAX_LIMIT).nonzero? || DEFAULT_LIMIT
    end

    # The model reads this, so it says what to do with what it got — including the case where a
    # source failed, which is otherwise invisible to it.
    def guidance(items, errors)
      parts = []
      if items.any?
        parts << "These #{items.size} picture#{'s' if items.size != 1} are now in the site's media library. " \
                 "Place one by setting an Image element's settings.src to its url and settings.alt to its alt text. " \
                 "Some carry a licence that expects a visible credit: when you use one, keep its credit somewhere on the page."
      else
        parts << "Nothing was added. Try a different phrase, or a different kind of image."
      end
      parts << "Some sources failed: #{errors.join('; ')}" if errors.any?
      parts.join(" ")
    end
  end
end
