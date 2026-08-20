module ContactForm
  class FormBlockComponent < ViewComponent::Base
    def initialize(data:)
      @title = data["title"].presence || "Get in touch"
    end
  end
end
