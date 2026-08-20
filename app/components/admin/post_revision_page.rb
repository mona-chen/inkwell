# frozen_string_literal: true

module Admin
  # Post revision show: side-by-side comparison of the live content and this revision,
  # with a restore action. Rendered from Admin::PostRevisionsController#show.
  class PostRevisionPage < ApplicationComponent
    def initialize(post:, revision:)
      @post = post
      @revision = revision
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          div do
            h1(class: "text-2xl font-bold tracking-tight") do
              "Revision from #{@revision.created_at.strftime("%b %-d, %Y at %l:%M%P")}"
            end
            p(class: "text-sm text-muted-foreground mt-1") { "by #{@revision.user.name}" }
          end
        end
        toolbar.trailing do
          render Button.new("All revisions", href: admin_post_revisions_path(@post), variant: :ghost)
        end
      end

      render Grid.new(cols: "1 lg:2", gap: 6) do
        render Card.new do |card|
          card.title { "Current" }
          card.body do
            p(class: "font-medium") { @post.title }
            raw BlockRenderer.render(@post.content_blocks, view_context)
          end
        end
        render Card.new do |card|
          card.title { "This revision" }
          card.body do
            p(class: "font-medium") { @revision.title_snapshot }
            raw BlockRenderer.render(@revision.content_snapshot, view_context)
          end
        end
      end

      render ButtonTo.new(
        "Restore this version",
        href: restore_admin_post_revision_path(@post, @revision),
        method: :post,
        variant: :primary,
        data: { turbo_confirm: "Restore this version?" }
      )
    end
  end
end
