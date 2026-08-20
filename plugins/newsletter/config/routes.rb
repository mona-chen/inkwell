Newsletter::Engine.routes.draw do
  resources :subscribers, only: [:index, :create]
end
