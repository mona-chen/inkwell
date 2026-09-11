require "rails_helper"

RSpec.describe Multisite::PluginGate do
  let(:site) { Site.create!(name: "Blog", domain: "blog.test", subdomain: "blog") }
  let!(:plugin) { InstalledPlugin.create!(slug: "test_gate_plugin", name: "Test Gate Plugin", version: "1.0", active: true) }

  around do |example|
    original = Current.site
    Current.site = site
    example.run
  ensure
    Current.site = original
  end

  describe ".active_for_site?" do
    it "is true for a globally active plugin with no activation row (opt-out default)" do
      expect(described_class.active_for_site?(site, plugin.slug)).to be(true)
    end

    it "is true when the site has an active activation row" do
      site.plugin_activations.create!(installed_plugin_id: plugin.id, active: true)
      expect(described_class.active_for_site?(site, plugin.slug)).to be(true)
    end

    it "is false when the site explicitly disabled the plugin (per_site mode)" do
      site.plugin_activations.create!(installed_plugin_id: plugin.id, active: false)
      expect(described_class.active_for_site?(site, plugin.slug)).to be(false)
    end

    it "ignores site rows in global mode" do
      site.update!(settings: { Multisite::PluginGate::MODE_KEY => "global" })
      site.plugin_activations.create!(installed_plugin_id: plugin.id, active: false)
      expect(described_class.active_for_site?(site, plugin.slug)).to be(true)
    end

    it "is false when the plugin is not globally active" do
      plugin.update!(active: false)
      expect(described_class.active_for_site?(site, plugin.slug)).to be(false)
    end

    it "is false for an unknown slug" do
      expect(described_class.active_for_site?(site, "not_a_plugin")).to be(false)
    end
  end

  describe ".active_for_current_site?" do
    it "runs (true) when no current site is set, e.g. in background jobs" do
      Current.site = nil
      expect(described_class.active_for_current_site?(plugin.slug)).to be(true)
    end
  end

  describe ".provision_default_activations!" do
    it "copies every globally active plugin onto a new site" do
      other = InstalledPlugin.create!(slug: "second_gate_plugin", name: "Second Gate Plugin", version: "1.0", active: true)
      described_class.provision_default_activations!(site)
      expect(site.plugin_activations.where(active: true).map { |a| a.installed_plugin.slug }).to contain_exactly(plugin.slug, other.slug)
    end
  end

  describe "Inkwell::Hooks gating" do
    before do
      Inkwell::Hooks.reset!
    end

    after do
      Inkwell::Hooks.reset!
    end

    it "skips a filter listener whose plugin is disabled for the current site" do
      Inkwell::Hooks.on_filter(:test_filter, source: plugin.slug) { |v| v + "|filtered" }
      Inkwell::Hooks.on_filter(:test_filter, source: "core")    { |v| v + "|core" }

      site.plugin_activations.create!(installed_plugin_id: plugin.id, active: false)
      expect(Inkwell::Hooks.filter(:test_filter, "value")).to eq("value|core")
    end

    it "runs the listener when the plugin is active for the current site" do
      Inkwell::Hooks.on_filter(:test_filter, source: plugin.slug) { |v| v + "|filtered" }
      expect(Inkwell::Hooks.filter(:test_filter, "value")).to eq("value|filtered")
    end

    it "skips an action listener whose plugin is disabled for the current site" do
      fired = []
      Inkwell::Hooks.on_action(:test_action, source: plugin.slug) { fired << :ran }
      site.plugin_activations.create!(installed_plugin_id: plugin.id, active: false)
      Inkwell::Hooks.fire(:test_action)
      expect(fired).to be_empty
    end
  end
end
