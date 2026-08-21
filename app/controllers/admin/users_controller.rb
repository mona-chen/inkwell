module Admin
  # User row management: list every account, create editors/authors/subscribers, change
  # roles, and deactivate (soft-delete) accounts without destroying their authored content.
  class UsersController < BaseController
    before_action :set_user, only: %i[update deactivate reactivate destroy]

    def index
      @users = Current.site.users.includes(:role).order(:name)
      render Admin::UsersPage.new(users: @users, roles: Role.order(:name), current_user: current_user)
    end

    def create
      user = Current.site.users.build(
        name: params[:name],
        email: params[:email],
        password: params[:password],
        role_id: params[:role_id]
      )
      if user.save
        redirect_to admin_users_path, notice: "#{user.name} invited."
      else
        redirect_to admin_users_path, alert: user.errors.full_messages.to_sentence
      end
    end

    def update
      attrs = params.slice(:name, :role_id).permit!
      attrs[:password] = params[:password] if params[:password].present?
      if @user.update(attrs)
        redirect_to admin_users_path, notice: "Updated."
      else
        redirect_to admin_users_path, alert: @user.errors.full_messages.to_sentence
      end
    end

    def deactivate
      if @user == current_user
        redirect_to admin_users_path, alert: "You can't deactivate your own account."
      else
        @user.deactivate!
        redirect_to admin_users_path, notice: "#{@user.name} deactivated."
      end
    end

    def reactivate
      @user.reactivate!
      redirect_to admin_users_path, notice: "#{@user.name} reactivated."
    end

    def destroy
      if @user == current_user
        redirect_to admin_users_path, alert: "You can't delete your own account."
      else
        @user.destroy
        redirect_to admin_users_path, notice: "User deleted."
      end
    end

    private

    def set_user
      # Users use a name-based to_param for public author URLs, so admin finds by the same
      # value (matches AuthorsController).
      @user = Current.site.users.find { |u| u.to_param == params[:id] }
      raise ActiveRecord::RecordNotFound unless @user
    end
  end
end
