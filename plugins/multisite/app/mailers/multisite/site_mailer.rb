class Multisite::SiteMailer < ApplicationMailer
  def invitation(invitation)
    @invitation = invitation
    @site = invitation.site
    @accept_url = Multisite::Engine.routes.url_helpers.accept_invitation_url(
      token: invitation.token,
      host: invitation.site.domain
    )

    mail(
      to: invitation.email,
      subject: "You've been invited to join #{@site.name} on Inkwell"
    )
  end
end
