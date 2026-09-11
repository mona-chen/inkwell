module Multisite
  class InvitationsController < ApplicationController
    layout false

    before_action :authenticate_user!, only: :accept

    def accept
      invitation = Multisite::SiteInvitation.find_by!(token: params[:token])

      if invitation.expired?
        render plain: "This invitation has expired.", status: :gone
        return
      end

      if invitation.accepted_at.present?
        render plain: "This invitation has already been accepted.", status: :ok
        return
      end

      # Only the intended recipient can accept.
      if current_user.email.to_s.downcase != invitation.email.to_s.downcase
        render plain: "This invitation is for #{invitation.email}.", status: :forbidden
        return
      end

      Multisite::UserSite.find_or_create_by!(user: current_user, site: invitation.site) do |us|
        us.role = invitation.role
      end

      if current_user.site_id.nil?
        current_user.update!(site: invitation.site)
      end

      invitation.accept!

      session["multisite.site_id"] = invitation.site.id
      redirect_to admin_root_path, notice: "Welcome to #{invitation.site.name}!"
    end
  end
end
