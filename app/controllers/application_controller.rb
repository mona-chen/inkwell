class ApplicationController < ActionController::Base
  include Pundit::Authorization

  before_action :set_current_attributes
  around_action :set_time_zone

  rescue_from Pundit::NotAuthorizedError, with: :render_forbidden

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
end
