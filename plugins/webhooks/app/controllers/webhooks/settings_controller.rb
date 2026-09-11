module Webhooks
  class SettingsController < Admin::BaseController
    def show
      render Webhooks::SettingsPage.new(site: Current.site)
    end
  end
end
