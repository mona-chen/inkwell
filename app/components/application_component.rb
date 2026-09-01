# Application-wide Phlex base. Inherits from Ink::Component so all descendants
# get Ink's helpers. Constant aliases let existing unqualified component references
# (Button, Card, Badge, …) resolve to Ink components without NitroKit.
class ApplicationComponent < Ink::Component
  # ActionView helpers the admin shell needs in its <head>. Included here so descendants
  # can call them directly instead of the deprecated `helpers.` view-context access.
  include Phlex::Rails::Helpers::CSRFMetaTags
  include Phlex::Rails::Helpers::CSPMetaTag
  include Phlex::Rails::Helpers::StylesheetLinkTag
  include Phlex::Rails::Helpers::JavascriptImportmapTags
  include Phlex::Rails::Helpers::TurboIncludeTags
  include Phlex::Rails::Helpers::Pluralize
  include Phlex::Rails::Helpers::DOMID
  include Phlex::Rails::Helpers::FormWith
  include Phlex::Rails::Helpers::FormFor
  include Phlex::Rails::Helpers::TurboFrameTag

  # Convenience aliases so existing unqualified component references resolve to Ink.
  Button           = Ink::Button
  ButtonTo         = Ink::ButtonTo
  Badge            = Ink::Badge
  Card             = Ink::Card
  EmptyState       = Ink::EmptyState
  Toolbar          = Ink::Toolbar
  ToolbarTitle     = Ink::ToolbarTitle
  SettingsSection  = Ink::SettingsSection
  Icon             = Ink::Icon
  Alert            = Ink::Alert
  DangerZone       = Ink::DangerZone
  Grid             = Ink::Grid
  Flex             = Ink::Flex
  Pagination       = Ink::Pagination
  DataSection      = Ink::DataSection
  Table            = Ink::Table
  SettingsLayout   = Ink::SettingsLayout
  Dropdown         = Ink::Dropdown
  CommandPalette   = Ink::CommandPalette
  Flash            = Ink::Flash
  Checkbox         = Ink::Checkbox
  Choice           = Ink::Choice
  RadioButtonGroup = Ink::RadioButtonGroup
  FormBuilder      = Ink::FormBuilder
  AuthShell        = Ink::AuthShell
  Shell            = Ink::Shell
  Navigation       = Ink::Navigation

  # Component helpers retained for concise call sites.
  def Grid(**, &block) = render(Ink::Grid.new(**, &block))
  def Flex(**, &block) = render(Ink::Flex.new(**, &block))
end
