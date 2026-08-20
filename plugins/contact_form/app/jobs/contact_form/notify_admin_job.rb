module ContactForm
  class NotifyAdminJob < ApplicationJob
    queue_as :default

    def perform(message_id)
      message = ContactForm::Message.find(message_id)
      Rails.logger.info("[ContactForm] New message from #{message.email}: #{message.body.truncate(80)}")
      # A real install would deliver an ActionMailer notification here.
    end
  end
end
