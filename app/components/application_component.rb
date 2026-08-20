# Application-wide Phlex base. Including NitroKit once makes the capitalized Kit methods
# (Button(...), Card(...), Flex(...), …) available to every descendant.
class ApplicationComponent < Phlex::HTML
  include NitroKit

  # ActionView helpers the admin shell needs in its <head>. Included here so descendants
  # can call them directly instead of the deprecated `helpers.` view-context access.
  include Phlex::Rails::Helpers::CSRFMetaTags
  include Phlex::Rails::Helpers::CSPMetaTag
  include Phlex::Rails::Helpers::StylesheetLinkTag
  include Phlex::Rails::Helpers::JavascriptImportmapTags
  include Phlex::Rails::Helpers::TurboIncludeTags
  include Phlex::Rails::Helpers::Routes
  include Phlex::Rails::Helpers::Pluralize
  include Phlex::Rails::Helpers::DOMID
  include Phlex::Rails::Helpers::FormWith
  include Phlex::Rails::Helpers::FormFor
end
