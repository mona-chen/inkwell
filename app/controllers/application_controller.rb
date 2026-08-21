class ApplicationController < ActionController::Base
  include Pundit::Authorization

  before_action :set_current_attributes
  around_action :set_time_zone

  rescue_from Pundit::NotAuthorizedError, with: :render_forbidden
  # Missing records (bad slugs, unpublished posts) and unknown actions get a proper 404 —
  # never the debugger/exception page. Public controllers render a themed page (theme is
  # already activated for the request); admin overrides with a plain 404.
  rescue_from ActiveRecord::RecordNotFound, AbstractController::ActionNotFound, ActionController::UnknownFormat, with: :render_not_found

  # Send admins to the dashboard after signing in; everyone else to the public home.
  def after_sign_in_path_for(resource)
    resource&.can?(:manage_site) || resource&.admin? ? admin_root_path : root_path
  end

  def after_sign_out_path_for(_resource_or_scope)
    new_user_session_path
  end

  private

  def set_current_attributes
    Current.user = current_user if respond_to?(:current_user)
    Current.site = Site.first # single-site default; multisite would resolve by request.host here
  end

  def set_time_zone(&block)
    Time.use_zone(Current.site&.setting("timezone", "UTC"), &block)
  end

  def render_forbidden
    render plain: "Forbidden", status: :forbidden
  end

  # Themed "errors/not_found" for HTML requests (falls back to a core template if the theme
  # doesn't ship one); plain 404 for JSON/API requests.
  def render_not_found
    respond_to do |format|
      format.html { render "errors/not_found", status: :not_found }
      format.any { head :not_found }
    end
  end
end
