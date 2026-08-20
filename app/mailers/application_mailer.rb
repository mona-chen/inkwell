class ApplicationMailer < ActionMailer::Base
  default from: -> { Current.site&.setting("mail_from", "no-reply@example.com") }
  layout "mailer"
end
