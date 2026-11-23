module ThemeRuntime
  # Normalizes the one public data shape used by fixtures, server injection,
  # Rails helpers, islands and Builder previews. Unknown keys are discarded.
  module Contract
    SITE_KEYS = %w[id name url logo].freeze
    SEO_KEYS = %w[title description canonical robots og twitter article schema sitemap].freeze
    PAGE_KEYS = %w[type id title slug url html excerpt image image_alt published_at updated_at modified_at reading_time word_count featured category categories tags toc author seo].freeze
    AUTHOR_KEYS = %w[id name slug url bio title avatar links posts_count].freeze
    TERM_KEYS = %w[id name slug description url count].freeze
    TOC_KEYS = %w[id text level].freeze
    LINK_KEYS = %w[kind label url].freeze
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
        "pagination" => normalize_pagination(data["pagination"]),
        "related" => Array(data["related"]).filter_map { |item| normalize_page(item) },
        "categories" => Array(data["categories"]).filter_map { |item| normalize_term(item) },
        "filter" => normalize_filter(data["filter"])
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
      result["category"] = data["category"].is_a?(Hash) ? normalize_term(data["category"]) : nil
      result["categories"] = Array(data["categories"]).filter_map { |item| normalize_term(item) }
      result["tags"] = Array(data["tags"]).filter_map { |item| normalize_term(item) }
      result["toc"] = Array(data["toc"]).filter_map { |item| item.is_a?(Hash) ? TOC_KEYS.to_h { |key| [ key, item[key] ] } : nil }
      result["featured"] = !!data["featured"]
      result
    end

    def normalize_term(value)
      return unless value.is_a?(Hash)

      TERM_KEYS.to_h { |key| [ key, value[key] ] }
    end

    # The active listing filter (category/tag/search) so themes can mark tabs as current.
    def normalize_filter(value)
      data = value.is_a?(Hash) ? value : {}
      %w[category tag q].to_h { |key| [ key, data[key].presence ] }
    end

    def normalize_author(value)
      data = value.is_a?(Hash) ? value : {}
      result = AUTHOR_KEYS.to_h { |key| [ key, data[key] ] }
      result["links"] = Array(data["links"]).filter_map { |item| item.is_a?(Hash) ? LINK_KEYS.to_h { |key| [ key, item[key] ] } : nil }
      result
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
      result["article"] = string_hash(data["article"]).compact_blank
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
