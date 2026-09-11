module Admin
  # Manage per-site API tokens for the read-only JSON API. Tokens are scoped to the current
  # site and grant read access to drafts/unpublished content.
  class ApiTokensController < BaseController
    before_action :set_token, only: :destroy

    def create
      name = params[:name].to_s.strip
      token = Current.site.api_tokens.create!(name: name.presence || "Token")
      # Reveal the token once on the next page load (POST-redirect-GET so Turbo performs a
      # full-page visit instead of discarding a full-HTML response to a turbo_stream request).
      session[:new_api_token] = token.token
      redirect_to admin_settings_path(section: "api"), notice: "API token created."
    rescue ActiveRecord::RecordInvalid => e
      redirect_to admin_settings_path(section: "api"), alert: e.record.errors.full_messages.to_sentence
    end

    def destroy
      @token.destroy!
      redirect_to admin_settings_path(section: "api"), notice: "API token revoked."
    end

    private

    def set_token
      @token = Current.site.api_tokens.find(params[:id])
    end
  end
end
