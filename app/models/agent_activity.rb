class AgentActivity < ApplicationRecord
  belongs_to :site
  belongs_to :agent_credential, optional: true
end
