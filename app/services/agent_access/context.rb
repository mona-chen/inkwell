module AgentAccess
  class Context
    attr_reader :credential, :site, :user, :activity
    def initialize(credential, activity: nil)
      @credential, @site, @user, @activity = credential, credential.site, credential.user, activity
    end

    def require_scope!(scope)
      raise Error, "Missing permission: #{scope}" unless credential.usable? && credential.allows?(scope)
    end

    def record(kind, id)
      scope = case kind
      when "page" then site.pages
      when "post" then site.posts
      else raise Error, "Unknown content type"
      end
      Pundit.policy_scope!(user, scope).find(id)
    end

    def authorize!(record, action)
      raise Error, "This account cannot #{action} this content" unless Pundit.policy!(user, record).public_send("#{action}?")
    end

    def check_version!(record, version)
      raise Error, "Content changed. Read it again before editing." unless record.updated_at.iso8601(6) == version
    end

    def snapshot(record)
      { "kind" => record.is_a?(Page) ? "page" : "post", "id" => record.id, "draft_content" => record.draft_content, "content" => record.content, "status" => record.status }
    end
  end
end
