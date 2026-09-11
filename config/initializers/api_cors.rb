require Rails.root.join("app/middleware/api_cors")

# Add CORS headers to the JSON API before the app handles the request.
Rails.application.config.middleware.insert_before(0, ApiCors)
