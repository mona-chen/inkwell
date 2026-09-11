module Multisite
  class OnboardingController < ApplicationController
    layout false

    before_action :authenticate_user!
    before_action :set_site

    STEPS = %w[welcome theme settings complete].freeze

    def show
      @step = params[:step] || "welcome"
      @step = "welcome" unless STEPS.include?(@step)
      render Multisite::OnboardingPage.new(site: @site, step: @step)
    end

    def update
      @step = params[:step] || "welcome"

      case @step
      when "welcome"
        @site.update!(name: params[:site_name]) if params[:site_name].present?
        redirect_to onboarding_path(step: "theme")
      when "theme"
        @site.update!(active_theme: params[:active_theme]) if params[:active_theme].present?
        redirect_to onboarding_path(step: "settings")
      when "settings"
        @site.update!(name: params[:site_name]) if params[:site_name].present?
        @site.set_setting!("tagline", params[:tagline]) if params[:tagline].present?
        redirect_to onboarding_path(step: "complete")
      when "complete"
        redirect_to main_app.admin_root_path, notice: "Your site is ready!"
      else
        redirect_to onboarding_path(step: "welcome")
      end
    end

    private

    def set_site
      @site = Current.site
      redirect_to main_app.admin_root_path unless @site
    end
  end
end
