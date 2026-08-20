require "devise/orm/active_record"

Devise.setup do |config|
  config.mailer_sender = "noreply@inkwell.dev"
  config.responder.error_status = :unprocessable_entity
  config.responder.redirect_status = :see_other
end
