namespace :imports do
  desc "Assign preserved URL paths to an existing capture's pages (does not publish). Usage: imports:preserve_paths[CAPTURE_ID]"
  task :preserve_paths, [:capture_id] => :environment do |_task, args|
    abort "A capture ID is required" if args[:capture_id].blank?
    pages = Page.where("meta ->> 'import_capture' = ?", args[:capture_id])
    abort "No pages found for this capture" unless pages.exists?
    Page.transaction do
      pages.find_each do |page|
        next if page.public_path.present?
        page.update!(public_path: URI.parse(page.original_import_url).path.presence || "/")
        puts "#{page.id}: #{page.public_path}"
      end
    end
  end
end
