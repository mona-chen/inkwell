module Admin
  class AgentCredentialsController < BaseController
    before_action :require_site_owner!
    def create
      scopes = params[:scopes].is_a?(Array) ? params[:scopes].map(&:to_s).uniq : []
      raise AgentAccess::Error, "Choose at least one permission" if scopes.empty?
      credential, secret = AgentCredential.issue!(site: Current.site, user: current_user, name: params[:name].to_s.strip.presence || "Agent", scopes: scopes)
      session[:new_agent_secret] = secret
      redirect_to admin_settings_path(section: "agents"), notice: "Agent credential created. Expires #{credential.expires_at.to_date}."
    rescue ActiveRecord::RecordInvalid, AgentAccess::Error => e
      redirect_to admin_settings_path(section: "agents"), alert: e.message
    end

    def destroy
      Current.site.agent_credentials.find(params[:id]).update!(revoked_at: Time.current)
      redirect_to admin_settings_path(section: "agents"), notice: "Agent access revoked."
    end

    private

    def require_site_owner!
      head :forbidden unless current_user.admin? || current_user.manages_site?(Current.site)
    end
  end
end
