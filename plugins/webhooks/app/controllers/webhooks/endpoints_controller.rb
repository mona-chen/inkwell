module Webhooks
  class EndpointsController < Admin::BaseController
    def create
      endpoint = Webhooks::Endpoint.new(endpoint_params.merge(site: Current.site))
      if endpoint.save
        redirect_to settings_path, notice: "Webhook endpoint created."
      else
        redirect_to settings_path, alert: endpoint.errors.full_messages.to_sentence
      end
    end

    def destroy
      endpoint = Webhooks::Endpoint.where(site_id: Current.site.id).find(params[:id])
      endpoint.destroy!
      redirect_to settings_path, notice: "Webhook endpoint deleted."
    end

    private

    def endpoint_params
      params.require(:endpoint).permit(:name, :url, events: [])
    end
  end
end
