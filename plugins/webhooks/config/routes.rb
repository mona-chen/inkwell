Webhooks::Engine.routes.draw do
  get "settings" => "settings#show", as: :settings
  post "endpoints" => "endpoints#create", as: :endpoints
  delete "endpoints/:id" => "endpoints#destroy", as: :endpoint
end
