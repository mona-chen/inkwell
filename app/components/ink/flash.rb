module Ink
  class Flash < Component
    def initialize(flash)
      @flash = flash
    end

    def view_template
      return if @flash.blank?
      div(class: "fixed top-3 right-3 z-50 flex flex-col gap-2 pointer-events-none") do
        @flash.each do |type, message|
          next if message.blank?
          css = case type.to_s
          when "notice", "success"
            "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
          when "alert", "error"
            "bg-destructive text-white border border-destructive"
          else
            "bg-card text-card-foreground border border-border"
          end
          div(class: "pointer-events-auto px-3 py-2 text-sm font-medium shadow-md rounded-md #{css}") { message }
        end
      end
    end
  end
end
