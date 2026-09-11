module Api
  module V1
    class SiteController < Api::BaseController
      def show
        render_jsonapi Api::SiteSerializer.call(
          Current.site,
          include_drafts: include_drafts?,
          base_url: base_url
        )
      end
    end
  end
end
