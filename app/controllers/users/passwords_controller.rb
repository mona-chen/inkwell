class Users::PasswordsController < Devise::PasswordsController
  # Render the application-owned password pages instead of the ERB views.
  def new
    self.resource = resource_class.new
    render Devise::PasswordRequestPage.new(
      resource: resource,
      resource_name: resource_name,
      submit_url: password_path(resource_name),
      back_url: new_session_path(resource_name)
    )
  end

  def edit
    self.resource = resource_class.new
    resource.reset_password_token = params[:reset_password_token]
    render Devise::PasswordEditPage.new(
      resource: resource,
      resource_name: resource_name,
      minimum_password_length: @minimum_password_length,
      submit_url: password_path(resource_name)
    )
  end
end
