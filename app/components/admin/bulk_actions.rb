module Admin
  class BulkActions < ApplicationComponent
    def initialize(kind:, status:, q:)
      @kind, @status, @q = kind, status, q
    end

    def view_template
      form_with(url: "/admin/#{@kind}/bulk", method: :post, id: "bulk-content-form", class: "content-bulk-bar", data: { action: "submit->bulk-selection#confirm" }) do |form|
        form.hidden_field :status, value: @status
        form.hidden_field :q, value: @q
        label(class: "content-select-all") do
          input(type: "checkbox", data: { bulk_selection_target: "all", action: "change->bulk-selection#toggleAll" }, aria: { label: "Select all #{@kind} on this page" })
          span { "Select page" }
        end
        span(class: "text-xs text-muted-foreground", data: { bulk_selection_target: "count" }, aria: { live: "polite" }) { "Select items to take action" }
        label(class: "sr-only", for: "bulk-action") { "Bulk action" }
        options = [["Choose action…", ""], ["Publish", "publish"], ["Unpublish", "draft"], ["Move to trash", "trash"]]
        options = [["Choose action…", ""], ["Restore as drafts", "restore"], ["Delete permanently", "delete"]] if @status == "trashed"
        form.select :bulk_action, options, {}, id: "bulk-action", required: true, class: "ink-control text-sm", data: { bulk_selection_target: "action" }
        render Button.new("Apply", type: :submit, variant: :outline, size: :sm, data: { bulk_selection_target: "submit" })
      end
    end
  end
end
