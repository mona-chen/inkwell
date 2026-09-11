module Multisite
  # Mixin for models that should be automatically scoped to the current site.
  # Include this in any model that has a `site_id` column to gain the
  # `for_current_site` scope and validate the association exists.
  #
  # Usage:
  #   class Post < ApplicationRecord
  #     include Multisite::CurrentScoped
  #   end
  #
  #   Post.for_current_site  # => Post.where(site_id: Current.site.id)
  module CurrentScoped
    extend ActiveSupport::Concern

    included do
      if respond_to?(:column_names) && column_names.include?("site_id")
        scope :for_current_site, -> {
          Current.site ? where(site_id: Current.site.id) : none
        }
      end
    end
  end
end
