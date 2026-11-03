module ThemeRuntime
  # Normalizes the one public data shape used by fixtures, server injection,
  # Rails helpers, islands and Builder previews. Unknown keys are discarded.
  module Contract
    SITE_KEYS = %w[id name url logo].freeze
    SEO_KEYS = %w[title description canonical robots og twitter schema sitemap].freeze
    PAGE_KEYS = %w[type id title slug url html excerpt published_at updated_at author seo].freeze
    AUTHOR_KEYS = %w[id name slug url bio avatar posts_count].freeze
    COMMENT_KEYS = %w[id post_id parent_id author body html created_at].freeze
    NAVIGATION_KEYS = %w[label url active children].freeze
    PAGINATION_KEYS = %w[page per_page total pages next previous].freeze

    module_function

    def normalize(value)
      data = deep_stringify(value)
      data = {} unless data.is_a?(Hash)
      {
        "site" => normalize_site(data["site"]),
        "navigation" => Array(data["navigation"]).filter_map { |item| normalize_navigation(item) },
        "page" => normalize_page(data["page"]),
        "posts" => Array(data["posts"]).filter_map { |item| normalize_page(item) },
        "authors" => Array(data["authors"]).filter_map { |item| normalize_author(item) },
        "comments" => Array(data["comments"]).filter_map { |item| normalize_comment(item) },
        "pagination" => normalize_pagination(data["pagination"])
      }
    end

    def normalize_site(value)
      data = value.is_a?(Hash) ? value : {}
      SITE_KEYS.to_h { |key| [ key, data[key] ] }
    end

    def normalize_page(value)
      data = value.is_a?(Hash) ? value : {}
      result = PAGE_KEYS.to_h { |key| [ key, data[key] ] }
      result["author"] = normalize_author(data["author"])
      result["seo"] = normalize_seo(data["seo"])
      result
    end

    def normalize_author(value)
      data = value.is_a?(Hash) ? value : {}
      AUTHOR_KEYS.to_h { |key| [ key, data[key] ] }
    end

    def normalize_comment(value)
      data = value.is_a?(Hash) ? value : {}
      result = COMMENT_KEYS.to_h { |key| [ key, data[key] ] }
      result["author"] = normalize_author(data["author"])
      result
    end

    def normalize_navigation(value)
      return unless value.is_a?(Hash)

      result = NAVIGATION_KEYS.to_h { |key| [ key, value[key] ] }
      result["active"] = !!result["active"]
      result["children"] = Array(value["children"]).filter_map { |item| normalize_navigation(item) }
      result
    end

    def normalize_seo(value)
      data = value.is_a?(Hash) ? value : {}
      result = SEO_KEYS.to_h { |key| [ key, data[key] ] }
      result["og"] = string_hash(data["og"])
      result["twitter"] = string_hash(data["twitter"])
      result["sitemap"] = data.key?("sitemap") ? !!data["sitemap"] : true
      result
    end

    def normalize_pagination(value)
      data = value.is_a?(Hash) ? value : {}
      PAGINATION_KEYS.to_h { |key| [ key, data[key] ] }.merge(
        "page" => (data["page"] || 1).to_i,
        "per_page" => (data["per_page"] || 10).to_i,
        "total" => (data["total"] || 0).to_i,
        "pages" => (data["pages"] || 0).to_i
      )
    end

    def string_hash(value)
      value.is_a?(Hash) ? value.transform_keys(&:to_s).transform_values(&:to_s) : {}
    end

    def deep_stringify(value)
      case value
      when Hash then value.to_h { |key, item| [ key.to_s, deep_stringify(item) ] }
      when Array then value.map { |item| deep_stringify(item) }
      else value
      end
    end
  end
end
