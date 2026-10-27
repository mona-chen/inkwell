# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc
]

# Agent secrets and executable snippets must not be echoed into parameter logs.
Rails.application.config.filter_parameters += [:new_agent_secret, :token_digest, :manifest, :custom_scripts_head, :custom_scripts_body]
