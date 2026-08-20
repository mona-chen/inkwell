# frozen_string_literal: true

module Admin
  # Comments moderation: a review queue — each comment as a card with the body front and
  # center, author/post context, and approve/spam/delete actions.
  class CommentsPage < ApplicationComponent
    STATUSES = %w[pending approved spam trashed].freeze

    def initialize(comments:, status:)
      @comments = comments
      @status = status
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Comments",
            subtitle: pluralize(@comments.total_count, "comment") + (pending? ? " · needs review" : "")
          )
        end
        toolbar.trailing do
          render Flex.new(dir: :row, gap: 1, wrap: :wrap) do
            STATUSES.each do |status|
              render Button.new(
                status.titleize,
                href: admin_comments_path(status: status),
                variant: @status == status ? :primary : :ghost,
                size: :sm
              )
            end
          end
        end
      end

      if @comments.empty?
        render_empty
      else
        render_queue
      end
    end

    private

    def pending?
      @status == "pending"
    end

    def render_queue
      div(class: "space-y-4") do
        @comments.each { |comment| render_comment_card(comment) }
      end
    end

    def render_comment_card(comment)
      div(class: "rounded-xl border border-border bg-background p-5 transition-colors hover:border-ring/30") do
        div(class: "flex items-start justify-between gap-4") do
          div(class: "min-w-0 flex-1") do
            div(class: "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm") do
              span(class: "font-semibold text-foreground") { comment.author_name }
              render Badge.new(comment.status, color: status_color(comment.status), size: :xs)
            end
            div(class: "mt-0.5 text-xs text-muted-foreground") do
              span { relative_time(comment.created_at) }
              if comment.post
                span(class: "text-muted-foreground/40") { " · on " }
                a(href: post_path(comment.post), target: "_blank", class: "font-medium text-primary hover:underline") do
                  comment.post.title
                end
              end
            end
          end
        end

        div(class: "mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90") { comment.body }

        div(class: "mt-4 flex flex-wrap items-center gap-2") do
          unless comment.status == "approved"
            render ButtonTo.new("Approve", href: admin_comment_path(comment, status: "approved"), method: :patch, variant: :primary, size: :sm, icon: :check)
          end
          unless comment.status == "spam"
            render ButtonTo.new("Mark spam", href: admin_comment_path(comment, status: "spam"), method: :patch, variant: :default, size: :sm, icon: :ban)
          end
          render ButtonTo.new(
            "Delete",
            href: admin_comment_path(comment),
            method: :delete,
            variant: :ghost,
            size: :sm,
            data: { turbo_confirm: "Delete this comment permanently?" }
          )
        end
      end
    end

    def render_empty
      render EmptyState.new(
        title: "No #{@status} comments",
        description: "Nothing here yet — check back later.",
        level: 3
      )
    end

    def relative_time(t)
      distance = Time.current - t
      case distance
      when 0...60 then "just now"
      when 60...3600 then "#{(distance / 60).to_i}m ago"
      when 3600...86_400 then "#{(distance / 3600).to_i}h ago"
      else t.strftime("%b %-d, %Y at %l:%M%P")
      end
    end

    def status_color(status)
      case status
      when "approved" then :success
      when "spam" then :danger
      when "trashed" then :neutral
      else :warning
      end
    end
  end
end
