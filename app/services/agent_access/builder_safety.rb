module AgentAccess
  # The human Builder supports trusted ERB, but a visual-edit credential must not
  # become a server-code credential. Reuse its data catalog for allowed bindings.
  module BuilderSafety
    module_function
    def validate!(value, client_code: false, path: [])
      case value
      when Hash
        value.each do |key, child|
          validate!(key.to_s, client_code: true)
          validate!(child, client_code: client_code, path: path + [key.to_s])
        end
      when Array then value.each { |child| validate!(child, client_code: client_code, path: path) }
      when String
        if !client_code && value.present?
          code_field = (path & %w[customJs custom_js attributesJson]).any?
          unsafe_markup = value.include?("<") && Rails::Html::SafeListSanitizer.new.sanitize(value) != value
          unsafe_url = value.match?(/\A\s*(?:javascript|vbscript|data):/i)
          raise Error, "Custom JavaScript, HTML and executable URLs require settings:write" if code_field || unsafe_markup || unsafe_url
        end
        raise Error, "Agent visual edits cannot introduce raw ERB" if value.include?("<%")
        value.scan(/\{\{\s*([a-zA-Z_][\w]*)\.([a-zA-Z_][\w.]*)\s*\}\}/).each do |source, field|
          fields = PageBuilder::DataSources.sources.dig(source, "fields") || {}
          raise Error, "Unknown dynamic field #{source}.#{field}" unless fields.key?(field)
        end
        value.scan(/\{\{\s*loop\s+([a-zA-Z_][\w]*)(?::(\d+))?\s*\}\}/).each do |source, count|
          raise Error, "Unknown dynamic loop #{source}" unless PageBuilder::DataSources.loop_sources.key?(source)
          raise Error, "Dynamic loops require a limit of 1–100 items" unless count && count.to_i.between?(1, 100)
        end
      end
    end
  end
end
