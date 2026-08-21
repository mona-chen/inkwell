module Newsletter
  class SubscribersController < ApplicationController
    def index
      @subscribers = Newsletter::Subscriber.where(site: Current.site).order(created_at: :desc)
    end

    def create
      subscriber = Newsletter::Subscriber.new(email: params[:email], site: Current.site)
      if subscriber.save
        redirect_back fallback_location: main_app.root_path, notice: "Subscribed!"
      else
        redirect_back fallback_location: main_app.root_path, alert: subscriber.errors.full_messages.to_sentence
      end
    end
  end
end
