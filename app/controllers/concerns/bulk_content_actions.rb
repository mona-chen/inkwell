module BulkContentActions
  extend ActiveSupport::Concern

  def bulk
    kind = controller_name == "posts" ? "posts" : "pages"
    relation = kind == "posts" ? policy_scope(Current.site.posts) : Current.site.pages.where(template_for: nil)
    ids = Array(params[:ids]).map(&:to_s).uniq
    raise ActiveRecord::RecordNotFound unless ids.all? { |id| id.match?(/\A[1-9]\d*\z/) }
    action = params[:bulk_action].to_s
    return redirect_to_bulk(kind, "Select at least one item.", alert: true) if ids.empty?
    return redirect_to_bulk(kind, "Select no more than 250 items at once.", alert: true) if ids.size > 250
    unless %w[publish draft trash restore delete].include?(action)
      return redirect_to_bulk(kind, "Choose a bulk action.", alert: true)
    end

    relation.klass.transaction do
      records = relation.where(id: ids).order(:id).lock.to_a
      raise ActiveRecord::RecordNotFound unless records.size == ids.size
      records.each { |record| authorize record, action == "publish" ? :publish? : %w[trash delete].include?(action) ? :destroy? : :update? }
      if action == "delete" && records.any? { |record| record.status != "trashed" }
        return redirect_to_bulk(kind, "Move items to trash before deleting them permanently.", alert: true)
      end
      records.each do |record|
        case action
        when "publish"
          if record.draft_content.present?
            record.is_a?(Page) ? record.publish_native! : record.publish_draft!
          else
            record.update!(status: "published")
          end
        when "draft", "restore" then record.update!(status: "draft", **(record.is_a?(Post) ? { scheduled_for: nil } : {}))
        when "trash" then record.update!(status: "trashed")
        when "delete" then record.destroy!
        end
      end
    end
    messages = { "publish" => "published", "draft" => "unpublished", "trash" => "moved to trash", "restore" => "restored as drafts", "delete" => "permanently deleted" }
    redirect_to_bulk(kind, "#{ids.size} #{kind} #{messages.fetch(action)}.")
  rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotDestroyed => error
    redirect_to_bulk(kind, "No changes made: #{error.record.errors.full_messages.to_sentence}", alert: true)
  end

  private

  def redirect_to_bulk(kind, message, alert: false)
    redirect_to url_for(controller: "/admin/#{kind}", action: :index, status: params[:status].presence, q: params[:q].presence, page: params[:page].presence), status: :see_other, **{ alert ? :alert : :notice => message }
  end
end
