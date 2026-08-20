PageBuilder::Engine.routes.draw do
  root "builder#index"
  get  ":record_type/:record_id" => "builder#edit"
  post "save"                    => "builder#save"
end
