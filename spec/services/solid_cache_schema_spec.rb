require "rails_helper"

RSpec.describe "Solid Cache schema" do
  it "ships the cache table so production GET requests can use Rack::Cache" do
    expect(ActiveRecord::Base.connection.table_exists?(:solid_cache_entries)).to be(true)

    store = ActiveSupport::Cache.lookup_store(:solid_cache_store)
    store.write("inkwell-cache-probe", "ok")
    expect(store.read("inkwell-cache-probe")).to eq("ok")
  ensure
    store&.delete("inkwell-cache-probe")
  end
end
