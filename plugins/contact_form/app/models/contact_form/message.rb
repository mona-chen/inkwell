module ContactForm
  class Message < ApplicationRecord
    self.table_name = "contact_form_messages"

    belongs_to :site

    validates :name, :email, :body, presence: true
  end
end
