require "rails_helper"
RSpec.describe AgentAccess::BuilderSafety do
  it "allows catalog fields and rejects raw Ruby and arbitrary model methods" do
    expect { described_class.validate!({ "text" => "{{ site.name }} / {{ page.title }}" }) }.not_to raise_error
    expect { described_class.validate!({ "html" => "<% Kernel.system('anything') %>" }) }.to raise_error(AgentAccess::Error)
    expect { described_class.validate!(["{{ site.destroy }}"]) }.to raise_error(AgentAccess::Error)
    expect { described_class.validate!("{{ loop posts:1000000 }}") }.to raise_error(AgentAccess::Error)
  end
end
