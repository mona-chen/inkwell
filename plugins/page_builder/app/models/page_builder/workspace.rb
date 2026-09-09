module PageBuilder
  # Shared draft, separate from publication. Row locks serialize concurrent patches;
  # each property carries its expected old value so stale clients cannot overwrite it.
  class Workspace < ApplicationRecord
    self.table_name = "builder_workspaces"
    belongs_to :site
    class Invalid < StandardError; end

    def patch!(operations)
      raise Invalid, "Too many changes in one update" unless operations.is_a?(Array) && operations.size <= 5000
      next_document = document.deep_dup
      conflicts = []
      operations.each do |op|
        path = op["path"]
        raise Invalid, "Invalid property path" unless path.is_a?(Array) && path.size.between?(1, 40) && path.all? { |key| key.is_a?(String) && key.size < 200 && !%w[__proto__ prototype constructor].include?(key) }
        raise Invalid, "Unknown document property" unless %w[nodes roots settings customCss customJs].include?(path.first)
        parent = path[0...-1].reduce(next_document) { |memo, key| memo.is_a?(Hash) ? memo[key] : nil }
        exists = parent.is_a?(Hash) && parent.key?(path.last)
        current = exists ? parent[path.last] : nil
        desired_matches = op["remove"] ? !exists : exists && current == op["value"]
        next if desired_matches
        unless parent.is_a?(Hash) && exists == !!op["existed"] && current == op["before"]
          conflicts << path
          next
        end
        op["remove"] ? parent.delete(path.last) : parent[path.last] = op["value"]
      end
      return conflicts if conflicts.any?
      self.class.validate_document!(next_document)
      if next_document != document
        self.document = next_document
        self.revision += 1
      end
      []
    end

    def self.validate_document!(state)
      raise Invalid, "Invalid shared document" unless state.is_a?(Hash) && state["nodes"].is_a?(Hash) && state["roots"].is_a?(Array) && state["settings"].is_a?(Hash)
      raise Invalid, "Shared document is too large" if state.to_json.bytesize > 5.megabytes || state["nodes"].size > 5000
      seen = Set.new
      visit = lambda do |id, depth|
        raise Invalid, "Invalid layer tree" if depth > 60 || !id.is_a?(String) || seen.include?(id)
        node = state["nodes"][id]
        raise Invalid, "Missing layer" unless node.is_a?(Hash) && node["type"].is_a?(String) && node["children"].is_a?(Array)
        seen << id
        node["children"].each { |child| visit.call(child, depth + 1) }
      end
      state["roots"].each { |id| visit.call(id, 0) }
      raise Invalid, "Unattached layer" unless seen.size == state["nodes"].size
    end
  end
end
