class Users::SessionsController < Devise::SessionsController
  layout false

  # Render the application-owned sign-in page instead of the ERB view.
  def new
    self.resource = resource_class.new(sign_in_params)
    clean_up_passwords(resource)
    render Devise::SignInPage.new(
      resource: resource,
      resource_name: resource_name,
      devise_mapping: Devise.mappings[:user],
      submit_url: session_path(resource_name),
      forgot_url: new_password_path(resource_name),
      sign_up_url: new_user_registration_path,
      registration_open: registration_open?
    )
  end

  private

  def registration_open?
    site = Current.site || Site.find_by(is_default: true) || Site.first
    (site&.setting("registration_mode") || "open") == "open"
  end
end
