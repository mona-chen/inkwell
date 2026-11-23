module Admin
  # Public author profile + account settings. Every signed-in user can edit their own
  # profile (name, role title, bio, avatar, links) and password; x  # public profile via ?author=<slug>.
  class ProfilesController < BaseController
    skip_before_action :require_admin_access!
    before_action :set_profile_user

    def show
      render Admin::ProfilePage.new(user: @user, own: own_profile?, public_url: public_profile_url(@user))
    end

    def update
      attributes = profile_params.to_h
      attributes["profile_links"] = Array(params.dig(:user, :profile_links)).map { |link| link.permit(:label, :url).to_h }.reject { |link| link["url"].blank? } if params.dig(:user, :profile_links)
      attributes["avatar_item_id"] = attributes["avatar_item_id"].presence

      saved = if own_profile? && password_change?
        @user.update_with_password(attributes.merge(params.require(:user).permit(:current_password, :password, :password_confirmation).to_h))
      else
        @user.update(attributes)
      end

      if saved
        bypass_sign_in(@user) if own_profile? && password_change?
        redirect_to admin_profile_path(author: (own_profile? ? nil : @user.to_param)), notice: "Profile saved."
      else
        flash.now[:alert] = @user.errors.full_messages.to_sentence
        render Admin::ProfilePage.new(user: @user, own: own_profile?, public_url: public_profile_url(@user)), status: :unprocessable_entity
      end
    end

    private

    def set_profile_user
      @user = if params[:author].present? && params[:author] != current_user.to_param
        raise ActiveRecord::RecordNotFound unless current_user.admin? || current_user.can?(:manage_users)
        Current.site.users.find { |user| user.to_param == params[:author] } || raise(ActiveRecord::RecordNotFound)
      else
        current_user
      end
    end

    def own_profile? = @user == current_user

    def password_change?
      params.dig(:user, :password).present?
    end

    def profile_params
      params.require(:user).permit(:name, :job_title, :bio, :avatar_item_id, :avatar_url)
    end

    def public_profile_url(user)
      ThemeRuntime::Request.new(site: Current.site, path: "/").serializer.author_path(user)
    rescue StandardError
      "/authors/#{user.to_param}"
    end
  end
end
