# frozen_string_literal: true

module Admin
  # Post revisions index: toolbar with the post title and a back-to-editor link, then
  # a DataSection table of revisions with a restore action (or an EmptyState when none
  # exist). Rendered from Admin::PostRevisionsController#index.
  class PostRevisionsPage < ApplicationComponent
    def initialize(post:, revisions:)
      @post = post
      @revisions = revisions
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Revision history",
            subtitle: @post.title
          )
        end
        toolbar.trailing do
          render Button.new("Back to editor", href: edit_admin_post_path(@post), variant: :ghost)
        end
      end

      render DataSection.new(title: "Revisions") do |section|
        if @revisions.empty?
          section.empty_state(
            EmptyState.new(
              title: "No saved revisions yet",
              description: "They're created automatically on every edit.",
              level: 3
            )
          )
        else
          section.table(Table.new) do |table|
            table.thead do
              table.tr do
                table.th("Title snapshot")
                table.th("Content")
                table.th("Author")
                table.th("Saved")
                table.th("", align: :right)
              end
            end
            table.tbody do
              @revisions.each do |revision|
                table.tr do
                  table.td do
                    a(href: admin_post_revision_path(@post, revision), class: "font-medium text-foreground hover:text-primary hover:underline") do
                      revision.title_snapshot
                    end
                  end
                  table.td { pluralize(revision.content_snapshot.to_a.length, "block") }
                  table.td(revision.user.name)
                  table.td(revision.created_at.strftime("%b %-d, %Y at %l:%M%P"))
                  table.td(align: :right) do
                    render ButtonTo.new(
                      "Restore",
                      href: restore_admin_post_revision_path(@post, revision),
                      method: :post,
                      variant: :default,
                      size: :xs,
                      data: {
                        turbo_confirm: "Restore this version? Your current draft will be replaced (but saved as a new revision first)."
                      }
                    )
                  end
                end
              end
            end
          end
        end
      end
    end
  end
end
