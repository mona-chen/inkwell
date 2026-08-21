module Admin
  # Widget area management: add/remove/reorder widgets for the theme's areas (sidebar,
  # footer columns). Mirrors WordPress's Appearance → Widgets.
  class WidgetsController < BaseController
    before_action :set_widget, only: %i[update destroy]

    def index
      @area = params[:area].to_s
      @area = "sidebar" unless Widget::AREAS.include?(@area)
      @widgets = Current.site.widgets.in_area(@area)
      render Admin::WidgetsPage.new(area: @area, widgets: @widgets)
    end

    def create
      attrs = widget_params
      attrs[:area] = "sidebar" unless Widget::AREAS.include?(attrs[:area])
      widget = Current.site.widgets.build(attrs)
      widget.position = Current.site.widgets.in_area(widget.area).maximum(:position).to_i + 1
      if widget.save
        redirect_to admin_widgets_path(area: widget.area), notice: "Widget added."
      else
        redirect_to admin_widgets_path(area: attrs[:area]), alert: widget.errors.full_messages.to_sentence
      end
    end

    def update
      if @widget.update(widget_params)
        redirect_to admin_widgets_path(area: @widget.area), notice: "Widget updated."
      else
        redirect_to admin_widgets_path(area: @widget.area), alert: @widget.errors.full_messages.to_sentence
      end
    end

    def destroy
      area = @widget.area
      @widget.destroy
      redirect_to admin_widgets_path(area: area), notice: "Widget removed."
    end

    private

    def set_widget
      @widget = Current.site.widgets.find(params[:id])
    end

    def widget_params
      params.require(:widget).permit(:kind, :area, :title, config: {})
    end
  end
end
