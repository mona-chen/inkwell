module Newsletter
  class Subscriber < ApplicationRecord
    self.table_name = "newsletter_subscribers"

    belongs_to :site

    validates :email, presence: true, uniqueness: { scope: :site_id }, format: { with: URI::MailTo::EMAIL_REGEXP }
  end
end
