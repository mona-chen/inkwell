class Users::SessionsController < Devise::SessionsController
  # Render the Nitro Kit sign-in page instead of the ERB view.
  def new
    self.resource = resource_class.new(sign_in_params)
    clean_up_passwords(resource)
    render Devise::SignInPage.new(
      resource: resource,
      resource_name: resource_name,
      devise_mapping: Devise.mappings[:user],
      submit_url: session_path(resource_name),
      forgot_url: new_password_path(resource_name)
    )
  end
end
