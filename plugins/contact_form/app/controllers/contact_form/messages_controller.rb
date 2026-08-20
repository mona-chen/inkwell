module ContactForm
  class MessagesController < ApplicationController
    def index
      @messages = ContactForm::Message.where(site: Current.site).order(created_at: :desc)
    end

    def create
      @message = ContactForm::Message.new(message_params.merge(site: Current.site))
      if @message.save
        Inkwell::Hooks.fire(:contact_form_submitted, @message)
        redirect_back fallback_location: root_path, notice: "Message sent — thanks!"
      else
        redirect_back fallback_location: root_path, alert: @message.errors.full_messages.to_sentence
      end
    end

    private

    def message_params
      params.require(:contact_form_message).permit(:name, :email, :body)
    end
  end
end
