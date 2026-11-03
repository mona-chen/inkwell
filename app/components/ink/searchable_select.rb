module Ink
  # Native form submission remains intact; Stimulus enhances only the picker UI.
  class SearchableSelect < Component
    def initialize(form:, name:, label:, options:, prompt: "Choose an option", source_action: nil)
      @form, @name, @label, @options, @prompt = form, name, label, options, prompt
      @source_action = source_action
      @id = "#{form.object_name}_#{name}_picker"
    end

    def view_template
      div(class: "ink-searchable-select", data: { controller: "searchable-select", action: "click@window->searchable-select#outside keydown->searchable-select#keydown" }) do
        div(data: { searchable_select_target: "fallback" }) do
          @form.field(@name, as: :select, label: @label, options: @options, include_blank: @prompt, control_html: { required: true, data: { searchable_select_target: "source", action: [@source_action, "change->searchable-select#sync invalid->searchable-select#invalid"].compact.join(" ") } })
        end
        div(hidden: true, data: { searchable_select_target: "enhanced" }) do
          label(id: "#{@id}_label", class: "ink-searchable-select-label") { @label }
          button(type: "button", role: "combobox", class: "ink-searchable-select-trigger", aria: { expanded: false, haspopup: "listbox", controls: "#{@id}_list", labelledby: "#{@id}_label #{@id}_value", required: true }, data: { searchable_select_target: "trigger", action: "click->searchable-select#toggle" }) do
            render Icon.new(:git_branch, size: :sm)
            span(id: "#{@id}_value", data: { searchable_select_target: "value" }) { @prompt }
            render Icon.new(:chevron_down, size: :sm)
          end
          div(hidden: true, class: "ink-searchable-select-popover", data: { searchable_select_target: "panel" }) do
            div(class: "ink-searchable-select-search") do
              render Icon.new(:search, size: :sm)
              input(type: "search", placeholder: "Search repositories…", autocomplete: "off", aria: { label: "Search repositories", controls: "#{@id}_list" }, data: { searchable_select_target: "search", action: "input->searchable-select#filter" })
            end
            div(id: "#{@id}_list", role: "listbox", aria: { label: @label }, class: "ink-searchable-select-options", data: { searchable_select_target: "list" })
            p(hidden: true, class: "ink-searchable-select-empty", role: "status", data: { searchable_select_target: "empty" }) { "No matching repositories. Try another name." }
          end
        end
      end
    end
  end
end
