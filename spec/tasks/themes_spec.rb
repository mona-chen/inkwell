require "rails_helper"
require "rake"

RSpec.describe "themes:verify" do
  before(:all) do
    Rails.application.load_tasks unless Rake::Task.task_defined?("themes:verify")
  end

  let!(:site) { Site.create!(name: "Deploy site", domain: "deploy.lvh.me", active_theme: "default") }

  def verify
    Rake::Task["themes:verify"].reenable
    Rake::Task["themes:verify"].invoke
  end

  it "accepts an installed active theme" do
    expect { verify }.to output(/Active themes verified/).to_stdout
  end

  it "stops a deployment when the database references a lost theme release" do
    site.update!(active_theme: "lost-imported-release")
    expect { verify }.to raise_error(SystemExit) { |error| expect(error.status).to eq(1) }
  end
end
