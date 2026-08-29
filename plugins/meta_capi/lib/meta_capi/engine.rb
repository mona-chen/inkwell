module MetaCapi
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace MetaCapi

    plugin_name "Meta Conversions API"
    plugin_description "Send server-side events (purchase, lead, page view, etc.) to Meta's Conversions API for better ad measurement and targeting."
    plugin_version "1.0.0"

    register_admin_nav(label: "Meta CAPI", path: "/plugins/meta_capi/settings", icon: "trending-up")

    def on_activate
      # Inject Meta Pixel base code + CAPI tracking into every page's body
      Inkwell::Hooks.on_filter(:body_scripts, source: plugin_slug, priority: 10) do |html, site:|
        next html unless site && site.setting("meta_pixel_id").present?

        pixel_id = site.setting("meta_pixel_id")
        capi_endpoint = MetaCapi::Engine.routes.url_helpers.events_path

        # Meta Pixel base code + CAPI server-side event beacon
        script = <<~HTML
          <!-- Meta Pixel Code -->
          <script>
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '#{ERB::Util.html_escape(pixel_id)}');
          fbq('track', 'PageView');
          </script>
          <noscript><img height="1" width="1" style="display:none"
            src="https://www.facebook.com/tr?id=#{ERB::Util.html_escape(pixel_id)}&ev=PageView&noscript=1"
          /></noscript>
          <!-- End Meta Pixel Code -->

          <!-- CAPI Server-Side Event Relay -->
          <script>
          (function() {
            // Relay client-side events to the server-side CAPI endpoint
            // so they include the visitor's IP and user agent for better matching.
            var endpoint = '#{capi_endpoint}';
            var sent = false;

            function sendPageView() {
              if (sent) return;
              sent = true;
              var data = new URLSearchParams();
              data.append('event_name', 'PageView');
              data.append('event_source_url', window.location.href);
              data.append('event_id', crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
              navigator.sendBeacon(endpoint, data);
            }

            if (document.readyState === 'complete') {
              sendPageView();
            } else {
              window.addEventListener('load', sendPageView);
            }
          })();
          </script>
        HTML

        html + script
      end

      # Fire when a post is published
      Inkwell::Hooks.on_action(:post_published, source: plugin_slug) do |post|
        next unless MetaCapi::Client.configured?(site_id: post.site_id)

        MetaCapi::SendEventJob.perform_later(
          event_name: "ViewContent",
          site_id: post.site_id,
          user_data: {
            client_ip_address: nil,
            client_user_agent: nil
          },
          custom_data: {
            content_name: post.title,
            content_type: "post",
            content_id: post.id.to_s
          },
          event_source_url: nil
        )
      end

      # Fire when the contact form plugin receives a submission
      Inkwell::Hooks.on_action(:contact_form_submitted, source: plugin_slug) do |message|
        site_id = message.respond_to?(:site_id) ? message.site_id : nil
        next unless site_id && MetaCapi::Client.configured?(site_id: site_id)

        MetaCapi::SendEventJob.perform_later(
          event_name: "Lead",
          site_id: site_id,
          user_data: {
            email: message.respond_to?(:email) ? message.email : nil,
            phone: message.respond_to?(:phone) ? message.phone : nil
          },
          custom_data: {
            content_name: "Contact Form Submission"
          },
          event_source_url: nil
        )
      end

      # Fire when a new newsletter subscriber is added
      Inkwell::Hooks.on_action(:newsletter_subscribed, source: plugin_slug) do |subscriber|
        site_id = subscriber.respond_to?(:site_id) ? subscriber.site_id : nil
        next unless site_id && MetaCapi::Client.configured?(site_id: site_id)

        MetaCapi::SendEventJob.perform_later(
          event_name: "Lead",
          site_id: site_id,
          user_data: {
            email: subscriber.email
          },
          custom_data: {
            content_name: "Newsletter Signup"
          },
          event_source_url: nil
        )
      end
    end

    def on_deactivate
      Inkwell::Hooks.remove_source!(plugin_slug)
    end
  end
end
