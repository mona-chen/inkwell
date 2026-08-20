class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # Deliberately NOT a global `default_scope { where(site_id: ...) }` here — multisite scoping
  # is explicit per-model (`Current.site.posts`, `Current.site.pages`) rather than implicit
  # magic, so a missing scope fails loudly (NoMethodError) instead of silently leaking data
  # across sites the way an accidentally-bypassed default_scope would.
end
