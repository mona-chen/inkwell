ImageSources::Engine.routes.draw do
  # The single endpoint the browser calls. Provider keys stay server-side, so this is a proxy
  # in the same sense as the Copilot's model calls: the client asks, the server fetches.
  get "search", to: "searches#index", as: :searches
  get "settings", to: "settings#show", as: :settings
  patch "settings", to: "settings#update"
end
