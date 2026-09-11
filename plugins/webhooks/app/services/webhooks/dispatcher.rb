module Webhooks
  # Fans a domain event out to every active endpoint on the record's site that subscribes to
  # it. Creates a Delivery audit row, then enqueues the HTTP delivery as background work.
  #
  # Background jobs have no `Current.site`, so the site is resolved from the record, and the
  # delivery carries everything the job needs.
  module Dispatcher
    module_function

    def dispatch(event, record)
      site = site_for(record)
      return unless site

      payload = Payload.build(event, record)

      Webhooks::Endpoint.active.where(site_id: site.id).find_each do |endpoint|
        next unless endpoint.subscribes_to?(event)

        delivery = endpoint.deliveries.create!(event: event.to_s, payload: payload)
        Webhooks::DeliverJob.perform_later(delivery.id)
      end
    end

    def site_for(record)
      return record if record.is_a?(Site)
      return record.site if record.respond_to?(:site) && record.site
      return Site.find_by(id: record.site_id) if record.respond_to?(:site_id)

      nil
    end
  end
end
