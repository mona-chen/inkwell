# Rails' CurrentAttributes — set from ApplicationController so models (e.g. Post#create_revision!)
# can know "who did this" without controllers passing the user down through every method call.
class Current < ActiveSupport::CurrentAttributes
  attribute :user, :site
end
