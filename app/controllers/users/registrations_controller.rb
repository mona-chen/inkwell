class Users::RegistrationsController < Devise::RegistrationsController
  layout false

  before_action :check_registration_allowed, only: %i[new create]

  # Public self-service account creation, scoped to the current site.
  def new
    self.resource = resource_class.new
    render_signup
  end

  def create
    @user = target_site.users.build(sign_up_params)
    @user.role = default_role

    if @user.save
      sign_in(@user)
      redirect_to root_path, notice: "Welcome to #{target_site.name}!"
    else
      render_signup(status: :unprocessable_entity)
    end
  end

  private

  def target_site
    Current.site || Site.find_by(is_default: true) || Site.first
  end

  def default_role
    Role.find_or_create_by!(name: "subscriber") { |role| role.capabilities = [] }
  end

  def sign_up_params
    params.require(:user).permit(:name, :email, :password, :password_confirmation)
  end

  def check_registration_allowed
    mode = target_site&.setting("registration_mode") || "open"
    return if mode == "open"

    message = case mode
    when "invite_only" then "Registration is by invitation only."
    else "Registration is currently closed."
    end
    redirect_to new_user_session_path, alert: message
  end

  def render_signup(status: nil)
    render(
      Devise::SignUpPage.new(
        resource: resource,
        resource_name: resource_name,
        submit_url: user_registration_path,
        sign_in_url: new_user_session_path
      ),
      status: status
    )
  end
end
