module Multisite
  class SendInvitationJob < ApplicationJob
    queue_as :default

    def perform(invitation_id)
      invitation = Multisite::SiteInvitation.find(invitation_id)
      return if invitation.accepted? || invitation.expired?

      Multisite::SiteMailer.invitation(invitation).deliver_now
    rescue StandardError => e
      Rails.logger.error("[Multisite] Failed to send invitation #{invitation_id}: #{e.message}")
    end
  end
end
