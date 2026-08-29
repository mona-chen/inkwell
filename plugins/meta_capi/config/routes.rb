MetaCapi::Engine.routes.draw do
  get "settings" => "settings#show"
  post "settings" => "settings#update"
  post "events" => "events#create"
end
