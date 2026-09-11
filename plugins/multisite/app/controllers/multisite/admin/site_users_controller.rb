module Multisite
  module Admin
    class SiteUsersController < BaseController
      before_action :find_site

      def index
        @user_sites = @site.user_sites.includes(:user).order("users.name")
        @invitations = @site.invitations.pending.order(created_at: :desc)
        render Multisite::Admin::SiteUsersPage.new(
          site: @site,
          user_sites: @user_sites,
          invitations: @invitations
        )
      end

      def create
        # Intentionally unscoped: super-admins may add existing users from any site.
        user = User.find_by(email: params[:email].to_s.strip.downcase)
        if user.nil?
          invitation = @site.invitations.build(
            email: params[:email].to_s.strip.downcase,
            role: params[:role] || "editor"
          )
          if invitation.save
            Multisite::SendInvitationJob.perform_later(invitation.id)
            redirect_to multisite_routes.admin_site_users_path(@site), notice: "Invitation sent to #{params[:email]}."
          else
            redirect_to multisite_routes.admin_site_users_path(@site), alert: invitation.errors.full_messages.to_sentence
          end
        else
          user_site = @site.user_sites.build(user: user, role: params[:role] || "editor")
          if user_site.save
            redirect_to multisite_routes.admin_site_users_path(@site), notice: "#{user.name} added to #{@site.name}."
          else
            redirect_to multisite_routes.admin_site_users_path(@site), alert: user_site.errors.full_messages.to_sentence
          end
        end
      end

      def update
        user_site = @site.user_sites.find(params[:id])
        user_site.update!(role: params[:role])
        redirect_to multisite_routes.admin_site_users_path(@site), notice: "Role updated."
      end

      def destroy
        user_site = @site.user_sites.find(params[:id])
        user = user_site.user
        user_site.destroy!
        redirect_to multisite_routes.admin_site_users_path(@site), notice: "#{user.name} removed from #{@site.name}."
      end

      private

      def find_site
        @site = Site.find(params[:site_id])
      end
    end
  end
end
