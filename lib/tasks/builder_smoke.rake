namespace :builder do
  desc "Run the Ink Builder browser smoke test (needs `bin/rails server` on :3000 and the seeded admin)"
  task :smoke do
    sh "node scripts/builder_smoke_test.js"
  end
end
