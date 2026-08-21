# Helpers for rendering theme widget areas (sidebar, footer columns). Themes call
# `render_widget_area(:sidebar)` inside their layouts/templates.
module WidgetsHelper
  # Latest published posts for the recent_posts widget.
  def self.recent_posts(site, count)
    site.posts.published.recent.limit(count)
  end

  # Render every widget in an area, or nil if there are none (so callers can hide the
  # container). Used from ERB theme templates: <%= render_widget_area(:sidebar) %>
  def render_widget_area(area)
    normalized = area.to_s.tr("_", "-")
    widgets = Current.site.widgets.in_area(normalized).to_a
    return nil if widgets.empty?

    render partial: "widgets/area", locals: { widgets: widgets }
  end

  # Render a single widget by kind. Kind → partial lookup mirrors BlockRenderer's
  # allow-list dispatch: unknown kinds render nothing, never crash.
  def render_widget(widget)
    partial = "widgets/#{widget.kind}_widget"
    render partial: partial, locals: { widget: widget, site: Current.site }
  rescue ActionView::MissingTemplate
    nil
  end
end
