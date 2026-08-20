require "rails_helper"

RSpec.describe Inkwell::Hooks do
  before { described_class.reset! }

  describe "actions" do
    it "fires all registered listeners for an action" do
      calls = []
      described_class.on_action(:post_published, source: "test_a") { |post| calls << [:a, post] }
      described_class.on_action(:post_published, source: "test_b") { |post| calls << [:b, post] }

      described_class.fire(:post_published, "my-post")

      expect(calls).to contain_exactly([:a, "my-post"], [:b, "my-post"])
    end

    it "respects priority ordering" do
      order = []
      described_class.on_action(:x, priority: 20) { order << :second }
      described_class.on_action(:x, priority: 10) { order << :first }

      described_class.fire(:x)

      expect(order).to eq(%i[first second])
    end

    it "isolates a listener's failure from other listeners in production-like mode" do
      allow(Rails.env).to receive(:test?).and_return(false)
      calls = []
      described_class.on_action(:x) { raise "boom" }
      described_class.on_action(:x) { calls << :ran }

      expect { described_class.fire(:x) }.not_to raise_error
      expect(calls).to eq([:ran])
    end
  end

  describe "filters" do
    it "pipes the value through each listener in order" do
      described_class.on_filter(:post_content, priority: 10) { |html| html.upcase }
      described_class.on_filter(:post_content, priority: 20) { |html| "#{html}!" }

      result = described_class.filter(:post_content, "hello")

      expect(result).to eq("HELLO!")
    end

    it "passes keyword context through to listeners" do
      described_class.on_filter(:title) { |val, post:| "#{val} (#{post})" }

      result = described_class.filter(:title, "Hi", post: "my-post")

      expect(result).to eq("Hi (my-post)")
    end
  end

  describe "plugin teardown" do
    it "removes only the given source's listeners" do
      described_class.on_action(:x, source: "plugin_a") {}
      described_class.on_action(:x, source: "plugin_b") {}

      described_class.remove_source!("plugin_a")

      expect(described_class.registry[:actions][:x].map(&:source)).to eq(["plugin_b"])
    end
  end
end
