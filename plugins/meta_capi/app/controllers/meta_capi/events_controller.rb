# frozen_string_literal: true

module MetaCapi
  # Server-side tracking endpoint for Meta CAPI events.
  # Called from the frontend (via JavaScript beacon) to send events like PageView
  # with the visitor's IP address and user agent for better matching.
  class EventsController < ApplicationController
    # POST /plugins/meta_capi/events
    def create
      site = Current.site
      unless site.setting("meta_pixel_id").present? && site.setting("meta_access_token").present?
        head :unprocessable_entity and return
      end

      MetaCapi::SendEventJob.perform_later(
        event_name: params[:event_name] || "PageView",
        site_id: site.id,
        user_data: {
          client_ip_address: request.remote_ip,
          client_user_agent: request.user_agent
        },
        custom_data: params[:custom_data]&.permit!&.to_h || {},
        event_source_url: params[:event_source_url] || request.referer,
        event_id: params[:event_id]
      )

      head :ok
    end
  end
end
