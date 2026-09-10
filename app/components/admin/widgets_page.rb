# frozen_string_literal: true

module Admin
  # Widget area management (WordPress Appearance → Widgets equivalent). Tabs switch between
  # the theme's areas; each shows its widgets with inline edit + delete and an add form.
  class WidgetsPage < ApplicationComponent
    AREA_LABELS = {
      "sidebar" => "Sidebar",
      "footer-1" => "Footer column 1",
      "footer-2" => "Footer column 2",
      "footer-3" => "Footer column 3"
    }.freeze

    def initialize(area:, widgets:)
      @area = area
      @widgets = widgets
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(title: "Widgets", subtitle: "Add reusable content to the theme's widget areas")
        end
      end

      div(class: "mb-4 flex flex-wrap gap-2") do
        Widget::AREAS.each do |area|
          render Button.new(
            AREA_LABELS[area],
            href: admin_widgets_path(area: area),
            variant: area == @area ? :primary : :ghost,
            size: :sm
          )
        end
      end

      Grid(cols: "1 lg:3", gap: 6) do
        div(class: "lg:col-span-2") do
          render Card.new do |card|
            card.title { AREA_LABELS[@area] }
            card.body do
              if @widgets.empty?
                div(class: "py-8 text-center text-sm text-muted-foreground") do
                  "No widgets in this area yet — add one on the right."
                end
              else
                ul(class: "divide-y divide-border") do
                  @widgets.each { |widget| render_widget_row(widget) }
                end
              end
            end
          end
        end

        div(class: "lg:col-span-1") do
          render Card.new do |card|
            card.title { "Add widget" }
            card.body do
              form_with(url: admin_widgets_path, method: :post, class: "space-y-3") do |f|
                div do
                  f.label :kind, "Type", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.select :kind, Widget::KINDS.map(&:titleize).zip(Widget::KINDS), {}, class: input_class
                end
                div do
                  f.label :title, "Title", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.text_field :title, class: input_class
                end
                div do
                  f.label :area, "Area", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.select :area, AREA_LABELS.map { |k, v| [ v, k ] }, { selected: @area }, class: input_class
                end
                div do
                  f.label :config_body, "Text content", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.text_area :config_body, name: "widget[config][body]", rows: 4, class: input_class
                end
                div(class: "grid grid-cols-2 gap-3") do
                  div do
                    f.label :config_count, "Recent post count", class: "mb-1 block text-xs font-medium text-muted-foreground"
                    f.number_field :config_count, name: "widget[config][count]", value: 5, min: 1, max: 20, class: input_class
                  end
                  div do
                    f.label :position, "Order", class: "mb-1 block text-xs font-medium text-muted-foreground"
                    f.number_field :position, value: @widgets.size + 1, min: 0, class: input_class
                  end
                end
                div do
                  f.label :config_url, "Social URL", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.text_field :config_url, name: "widget[config][url]", placeholder: "https://…", class: input_class
                end
                div do
                  f.label :config_label, "Social link label", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.text_field :config_label, name: "widget[config][label]", placeholder: "Follow us", class: input_class
                end
                p(class: "text-[11px] leading-4 text-muted-foreground") { "Only fields used by the selected widget type appear on the site." }
                f.submit "Add widget", class: "inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
              end
            end
          end
        end
      end
    end

    private

    def input_class
      "min-h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
    end

    def render_widget_row(widget)
      li(class: "py-3") do
        form_with(url: admin_widget_path(widget), method: :patch, class: "space-y-2") do |f|
          div(class: "flex items-center gap-3") do
            div(class: "min-w-0 flex-1") do
              div(class: "text-sm font-medium text-foreground") { widget.title.presence || widget.kind.titleize }
              div(class: "text-xs text-muted-foreground") { widget.kind.titleize }
            end
            f.submit "Save", class: "rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            render ButtonTo.new("Remove", href: admin_widget_path(widget), method: :delete, variant: :ghost, size: :xs,
              data: { turbo_confirm: "Remove this widget?" })
          end
          if widget.kind == "text"
            f.text_area :config_body, name: "widget[config][body]", rows: 2, value: widget.config["body"],
              class: input_class
          elsif widget.kind == "recent_posts"
            div(class: "grid grid-cols-2 gap-3") do
              f.number_field :config_count, name: "widget[config][count]", value: widget.config["count"] || 5, min: 1, max: 20, class: input_class
              f.number_field :position, value: widget.position, min: 0, class: input_class
            end
          elsif widget.kind == "social"
            div(class: "grid gap-3 sm:grid-cols-2") do
              f.text_field :config_url, name: "widget[config][url]", value: widget.config["url"], placeholder: "https://…", class: input_class
              f.text_field :config_label, name: "widget[config][label]", value: widget.config["label"], placeholder: "Follow us", class: input_class
            end
          end
        end
      end
    end
  end
end
