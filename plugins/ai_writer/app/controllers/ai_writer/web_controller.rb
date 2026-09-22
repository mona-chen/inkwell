module AiWriter
  # The one endpoint the browser's web tools call. It is a proxy on purpose: the search key
  # stays on the server, and the private-address guard in WebClient is the only thing standing
  # between a model-chosen URL and the server's own network.
  #
  # Fetch is keyless; search needs a provider. Each is refused with a reason the model can act on
  # rather than a bare failure, because the model's next turn is shaped by that message.
  class WebController < Admin::BaseController
    def create
      client = WebClient.new(site: Current.site)

      case params[:op].to_s
      when "search"
        return render json: { error: "Web search is not configured for this site." }, status: :unprocessable_entity unless client.search_configured?

        render json: client.search(params[:query], limit: params[:limit])
      else
        return render json: { error: "Reading web pages is switched off for this site." }, status: :unprocessable_entity unless client.fetch_enabled?

        render json: client.fetch(params[:url])
      end
    rescue WebClient::Error => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end
end
