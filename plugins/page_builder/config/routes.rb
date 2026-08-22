PageBuilder::Engine.routes.draw do
  root "builder#index"
  get  "workspace/pages"         => "builder#workspace_pages"
  get  "workspace/captures"      => "builder#workspace_captures"
  get  "workspace/captures/:capture_id" => "builder#workspace_capture"
  post "workspace/captures/:capture_id/import" => "builder#import_workspace_capture"
  get  ":record_type/:record_id/preview" => "builder#preview"
  get  ":record_type/:record_id" => "builder#edit"
  post "save"                    => "builder#save"
  post "upload_asset"            => "builder#upload_asset"
end
