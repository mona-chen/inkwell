module PageBuilder
  class WorkspacesController < ::ApplicationController
    before_action :authenticate_user!
    before_action :authorize_editor!
    before_action :set_workspace
    rescue_from Workspace::Invalid, with: :invalid_document

    def comments
      render json: { threads: @workspace.threads }
    end

    def sync
      payload = params.to_unsafe_h
      client_id = payload["client_id"].to_s
      raise Workspace::Invalid, "Invalid editor session" unless client_id.match?(/\A[a-zA-Z0-9-]{16,80}\z/)
      response_payload = nil
      conflict = false
      @workspace.with_lock do
        if @workspace.document.empty?
          Workspace.validate_document!(payload["initial"])
          @workspace.document = payload["initial"]
        end
        peers = @workspace.participants.reject { |_id, peer| peer["seen_at"].to_i < 25.seconds.ago.to_i }
        peers[client_id] = { "user_id" => current_user.id, "name" => current_user.name, "seen_at" => Time.current.to_i, "selection" => Array(payload["selection"]).first(20).map(&:to_s) }
        @workspace.participants = peers
        conflicts = payload["operations"].present? ? @workspace.patch!(payload["operations"]) : []
        conflict = conflicts.any?
        @workspace.save!
        response_payload = snapshot.merge(conflicts: conflicts)
      end
      render json: response_payload, status: conflict ? :conflict : :ok
    end

    def comment
      @workspace.with_lock do
        threads = @workspace.threads.deep_dup
        thread = threads.find { |item| item["id"] == params[:thread_id] }
        case params[:operation]
        when "create"
          raise Workspace::Invalid, "Join the shared workspace first" if @workspace.document.empty?
          anchor = params[:anchor].to_s.presence
          raise Workspace::Invalid, "Layer no longer exists" if anchor && !@workspace.document.fetch("nodes", {}).key?(anchor)
          point = params[:point].present? ? params[:point].permit(:x, :y).to_h.transform_values { |value| Float(value, exception: false) } : nil
          raise Workspace::Invalid, "Invalid comment position" if point && (!point.values.all? { |v| v&.finite? && v.between?(0, anchor ? 1 : 100_000) } || point.keys.sort != %w[x y])
          thread = { "id" => SecureRandom.uuid, "anchor" => anchor, "point" => point, "resolved" => false, "messages" => [comment_message] }
          threads << thread
        when "reply"
          raise Workspace::Invalid, "Comment not found" unless thread
          thread["messages"] << comment_message
        when "resolve", "reopen"
          raise Workspace::Invalid, "Comment not found" unless thread
          thread["resolved"] = params[:operation] == "resolve"
        else
          raise Workspace::Invalid, "Unknown comment action"
        end
        raise Workspace::Invalid, "Comment limit reached" if threads.size > 1000 || threads.to_json.bytesize > 2.megabytes
        @workspace.update!(threads: threads)
        render json: snapshot
      end
    end

    private

    def authorize_editor!
      head :forbidden unless current_user.site_id == Current.site.id && (current_user.can?(:manage_site) || current_user.admin?)
    end

    def set_workspace
      kind = params[:record_type] == "page" ? "Page" : "Post"
      record = (kind == "Page" ? Current.site.pages : Current.site.posts).friendly.find(params[:record_id])
      @workspace = Workspace.find_or_create_by!(site: Current.site, record_type: kind, record_id: record.id)
    end

    def snapshot
      { revision: @workspace.revision, document: @workspace.document, participants: @workspace.participants, threads: @workspace.threads }
    end

    def comment_message
      text = params[:text].to_s.strip
      raise Workspace::Invalid, "Write a comment of 1–4000 characters" unless text.length.between?(1, 4000)
      { "id" => SecureRandom.uuid, "user_id" => current_user.id, "author" => current_user.name, "text" => text, "created_at" => Time.current.iso8601 }
    end

    def invalid_document(error)
      render json: { error: error.message }, status: :unprocessable_entity
    end
  end
end
