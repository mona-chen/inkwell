class CarouselSettingsControl {
    constructor(values, callbacks) {
        console.log('CarouselSettingsControl: Constructor called with values:', values);
        console.log('CarouselSettingsControl: Constructor called with callbacks:', Object.keys(callbacks || {}));
        this.id = '_' + Math.random().toString(36).substr(2, 9);
        // Initialize properties
        this.values = values; // Initial values for the carousel settings
        this.callbacks = callbacks; // Hash of callback functions to handle changes
        
        // controll attributes - flat structure initialization from passed values
        this.socialMedia = this.values.socialMedia || 'linkedin';
        this.selectedColorsBackground = this.values.selectedColorsBackground || '#254045';
        this.selectedColorsTextColor = this.values.selectedColorsTextColor || '#ffffff';
        this.selectedColorsAccent = this.values.selectedColorsAccent || '#b0c4c1';
        this.alternateColors = this.values.alternateColors !== undefined ? this.values.alternateColors : false;
        this.typographySize = this.values.typographySize || 'medium';
        this.typographyAlignment = this.values.typographyAlignment || 'center';
        this.typographyFontFamily = this.values.typographyFontFamily || 'dm-serif-dm-sans';
        this.typographyUppercaseTitles = this.values.typographyUppercaseTitles !== undefined ? this.values.typographyUppercaseTitles : false;
        this.typographyCustomFontPairing = this.values.typographyCustomFontPairing !== undefined ? this.values.typographyCustomFontPairing : false;
        this.backgroundElementsEnabled = this.values.backgroundElementsEnabled !== undefined ? this.values.backgroundElementsEnabled : true;
        this.backgroundElementsDesignElement = this.values.backgroundElementsDesignElement || 'confetti-burst';
        this.slidesCounterEnabled = this.values.slidesCounterEnabled !== undefined ? this.values.slidesCounterEnabled : true;
        this.slidesCounterStyle = this.values.slidesCounterStyle || 'filled';
        this.slidesCounterRoundness = this.values.slidesCounterRoundness !== undefined ? this.values.slidesCounterRoundness : 50;
        this.identityBrandEnabled = this.values.identityBrandEnabled !== undefined ? this.values.identityBrandEnabled : true;
        this.identityBrandBrandType = this.values.identityBrandBrandType || 'personal';
        this.identityBrandOrientation = this.values.identityBrandOrientation || 'top';
        this.identityBrandHeadshotEnabled = this.values.identityBrandHeadshotEnabled !== undefined ? this.values.identityBrandHeadshotEnabled : true;
        this.identityBrandHeadshotImage = this.values.identityBrandHeadshotImage || null;
        this.identityBrandNameEnabled = this.values.identityBrandNameEnabled !== undefined ? this.values.identityBrandNameEnabled : true;
        this.identityBrandNameValue = this.values.identityBrandNameValue || 'Fernando';
        this.identityBrandHandleEnabled = this.values.identityBrandHandleEnabled !== undefined ? this.values.identityBrandHandleEnabled : true;
        this.identityBrandHandleValue = this.values.identityBrandHandleValue || 'Founder at uCarousels';
        this.identityBrandWebsiteEnabled = this.values.identityBrandWebsiteEnabled !== undefined ? this.values.identityBrandWebsiteEnabled : true;
        this.identityBrandWebsiteValue = this.values.identityBrandWebsiteValue || 'www.aiCarousels.com';
        this.identityBrandShowIntroOutro = this.values.identityBrandShowIntroOutro !== undefined ? this.values.identityBrandShowIntroOutro : true;

        //
        this.render(); // Call the render method to create the UI
    }

    render() {
        console.log('CarouselSettingsControl: render() called');
        if (!this.domNode) { 
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'CarouselSettingsControl');
        }

        // render control html
        console.log('CarouselSettingsControl: Rendering template with current values');
        this.domNode.innerHTML = builder.renderTemplate('CarouselSettingsControl', {
            // Pass current values to template for initial state - flat structure
            socialMedia: this.socialMedia,
            selectedColorsBackground: this.selectedColorsBackground,
            selectedColorsTextColor: this.selectedColorsTextColor,
            selectedColorsAccent: this.selectedColorsAccent,
            alternateColors: this.alternateColors,
            typographySize: this.typographySize,
            typographyAlignment: this.typographyAlignment,
            typographyFontFamily: this.typographyFontFamily,
            typographyUppercaseTitles: this.typographyUppercaseTitles,
            typographyCustomFontPairing: this.typographyCustomFontPairing,
            backgroundElementsEnabled: this.backgroundElementsEnabled,
            backgroundElementsDesignElement: this.backgroundElementsDesignElement,
            slidesCounterEnabled: this.slidesCounterEnabled,
            slidesCounterStyle: this.slidesCounterStyle,
            slidesCounterRoundness: this.slidesCounterRoundness,
            identityBrandEnabled: this.identityBrandEnabled,
            identityBrandBrandType: this.identityBrandBrandType,
            identityBrandOrientation: this.identityBrandOrientation,
            identityBrandHeadshotEnabled: this.identityBrandHeadshotEnabled,
            identityBrandHeadshotImage: this.identityBrandHeadshotImage,
            identityBrandNameEnabled: this.identityBrandNameEnabled,
            identityBrandNameValue: this.identityBrandNameValue,
            identityBrandHandleEnabled: this.identityBrandHandleEnabled,
            identityBrandHandleValue: this.identityBrandHandleValue,
            identityBrandWebsiteEnabled: this.identityBrandWebsiteEnabled,
            identityBrandWebsiteValue: this.identityBrandWebsiteValue,
            identityBrandShowIntroOutro: this.identityBrandShowIntroOutro
        });

        // Add event listeners for the controls
        this.setupEventListeners();
        
        console.log('CarouselSettingsControl: render() completed');
    }

    afterRender() {
        var _this = this;
    }

    setupEventListeners() {
        var _this = this;

        // Social Media Select
        const socialMediaSelect = this.domNode.querySelector('#socialMediaSelect');
        if (socialMediaSelect) {
            socialMediaSelect.addEventListener('change', function() {
                console.log('CarouselSettingsControl: Social Media changed to:', this.value);
                _this.socialMedia = this.value;
                if (_this.callbacks && _this.callbacks.setSocialMedia) {
                    console.log('CarouselSettingsControl: Calling setSocialMedia callback');
                    _this.callbacks.setSocialMedia(_this.socialMedia);
                }
            });
        }

        // Color Swatches
        const colorSwatches = this.domNode.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', function() {
                const color = this.getAttribute('data-color');
                console.log('CarouselSettingsControl: Color swatch clicked, color:', color);
                // For now, update background color - could be enhanced to select which color property
                _this.selectedColorsBackground = color;
                if (_this.callbacks && _this.callbacks.setSelectedColorsBackground) {
                    console.log('CarouselSettingsControl: Calling setSelectedColorsBackground callback');
                    _this.callbacks.setSelectedColorsBackground(color);
                }
            });
        });

        // Alternate Colors
        const alternateColorsCheckbox = this.domNode.querySelector('#alternateColors');
        if (alternateColorsCheckbox) {
            alternateColorsCheckbox.addEventListener('change', function() {
                _this.alternateColors = this.checked;
                if (_this.callbacks && _this.callbacks.setAlternateColors) {
                    _this.callbacks.setAlternateColors(_this.alternateColors);
                }
            });
        }

        // Typography Size
        const sizeRadios = this.domNode.querySelectorAll('input[name="sizeRadio"]');
        sizeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    _this.typographySize = this.id === 'sizeSmall' ? 'small' : 'medium';
                    console.log('CarouselSettingsControl: Typography size changed to:', _this.typographySize);
                    if (_this.callbacks && _this.callbacks.setTypographySize) {
                        console.log('CarouselSettingsControl: Calling setTypographySize callback');
                        _this.callbacks.setTypographySize(_this.typographySize);
                    }
                }
            });
        });

        // Typography Alignment
        const alignmentRadios = this.domNode.querySelectorAll('input[name="alignmentRadio"]');
        alignmentRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    _this.typographyAlignment = this.id === 'alignLeft' ? 'left' : 'center';
                    if (_this.callbacks && _this.callbacks.setTypographyAlignment) {
                        _this.callbacks.setTypographyAlignment(_this.typographyAlignment);
                    }
                }
            });
        });

        // Font Family
        const fontSelect = this.domNode.querySelector('#fontSelect');
        if (fontSelect) {
            fontSelect.addEventListener('change', function() {
                console.log('CarouselSettingsControl: Font family changed to:', this.value);
                _this.typographyFontFamily = this.value;
                if (_this.callbacks && _this.callbacks.setTypographyFontFamily) {
                    console.log('CarouselSettingsControl: Calling setTypographyFontFamily callback');
                    _this.callbacks.setTypographyFontFamily(_this.typographyFontFamily);
                }
            });
        }

        // Uppercase Titles
        const uppercaseTitlesCheckbox = this.domNode.querySelector('#uppercaseTitles');
        if (uppercaseTitlesCheckbox) {
            uppercaseTitlesCheckbox.addEventListener('change', function() {
                _this.typographyUppercaseTitles = this.checked;
                if (_this.callbacks && _this.callbacks.setTypographyUppercaseTitles) {
                    _this.callbacks.setTypographyUppercaseTitles(_this.typographyUppercaseTitles);
                }
            });
        }

        // Custom Font Pairing
        const customFontPairingCheckbox = this.domNode.querySelector('#customFontPairing');
        if (customFontPairingCheckbox) {
            customFontPairingCheckbox.addEventListener('change', function() {
                _this.typographyCustomFontPairing = this.checked;
                if (_this.callbacks && _this.callbacks.setTypographyCustomFontPairing) {
                    _this.callbacks.setTypographyCustomFontPairing(_this.typographyCustomFontPairing);
                }
            });
        }

        // Background Elements Enabled
        const backgroundElementsEnabled = this.domNode.querySelector('#backgroundElementsEnabled');
        if (backgroundElementsEnabled) {
            backgroundElementsEnabled.addEventListener('change', function() {
                _this.backgroundElementsEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setBackgroundElementsEnabled) {
                    _this.callbacks.setBackgroundElementsEnabled(_this.backgroundElementsEnabled);
                }
            });
        }

        // Design Element Select
        const designElementSelect = this.domNode.querySelector('#designElementSelect');
        if (designElementSelect) {
            designElementSelect.addEventListener('change', function() {
                _this.backgroundElementsDesignElement = this.value;
                if (_this.callbacks && _this.callbacks.setBackgroundElementsDesignElement) {
                    _this.callbacks.setBackgroundElementsDesignElement(_this.backgroundElementsDesignElement);
                }

                console.log('CarouselSettingsControl: Design element changed to:', _this.backgroundElementsDesignElement);
            });
        }

        // Slides Counter Enabled
        const slidesCounterEnabled = this.domNode.querySelector('#slidesCounterEnabled');
        if (slidesCounterEnabled) {
            slidesCounterEnabled.addEventListener('change', function() {
                _this.slidesCounterEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setSlidesCounterEnabled) {
                    _this.callbacks.setSlidesCounterEnabled(_this.slidesCounterEnabled);
                }
            });
        }

        // Slides Counter Style
        const styleRadios = this.domNode.querySelectorAll('input[name="styleRadio"]');
        styleRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    _this.slidesCounterStyle = this.id === 'styleRadio1' ? 'filled' : 'outline';
                    if (_this.callbacks && _this.callbacks.setSlidesCounterStyle) {
                        _this.callbacks.setSlidesCounterStyle(_this.slidesCounterStyle);
                    }
                }
            });
        });

        // Roundness Range
        const roundnessRange = this.domNode.querySelector('#roundnessRange');
        if (roundnessRange) {
            roundnessRange.addEventListener('input', function() {
                _this.slidesCounterRoundness = parseInt(this.value);
                if (_this.callbacks && _this.callbacks.setSlidesCounterRoundness) {
                    _this.callbacks.setSlidesCounterRoundness(_this.slidesCounterRoundness);
                }
            });
        }

        // Identity & Brand Enabled
        const identityBrandEnabled = this.domNode.querySelector('#identityBrandEnabled');
        if (identityBrandEnabled) {
            identityBrandEnabled.addEventListener('change', function() {
                _this.identityBrandEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setIdentityBrandEnabled) {
                    _this.callbacks.setIdentityBrandEnabled(_this.identityBrandEnabled);
                }
            });
        }

        // Brand Type
        const brandTypeRadios = this.domNode.querySelectorAll('input[name="brandTypeRadio"]');
        brandTypeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    _this.identityBrandBrandType = this.id === 'brandPersonal' ? 'personal' : 'business';
                    console.log('CarouselSettingsControl: Brand type changed to:', _this.identityBrandBrandType);
                    if (_this.callbacks && _this.callbacks.setIdentityBrandBrandType) {
                        console.log('CarouselSettingsControl: Calling setIdentityBrandBrandType callback');
                        _this.callbacks.setIdentityBrandBrandType(_this.identityBrandBrandType);
                    }
                }
            });
        });

        // Orientation
        const orientationRadios = this.domNode.querySelectorAll('input[name="orientationRadio"]');
        orientationRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    _this.identityBrandOrientation = this.id === 'orientationTop' ? 'top' : 'bottom';
                    if (_this.callbacks && _this.callbacks.setIdentityBrandOrientation) {
                        _this.callbacks.setIdentityBrandOrientation(_this.identityBrandOrientation);
                    }
                }
            });
        });

        // Headshot Enabled
        const headshotEnabled = this.domNode.querySelector('#headshotEnabled');
        if (headshotEnabled) {
            headshotEnabled.addEventListener('change', function() {
                _this.identityBrandHeadshotEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setIdentityBrandHeadshotEnabled) {
                    _this.callbacks.setIdentityBrandHeadshotEnabled(_this.identityBrandHeadshotEnabled);
                }
            });
        }

        // Name Enabled
        const nameEnabled = this.domNode.querySelector('#nameEnabled');
        if (nameEnabled) {
            nameEnabled.addEventListener('change', function() {
                _this.identityBrandNameEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setIdentityBrandNameEnabled) {
                    _this.callbacks.setIdentityBrandNameEnabled(_this.identityBrandNameEnabled);
                }
            });
        }

        // Name Input
        const nameInput = this.domNode.querySelector('#nameInput');
        if (nameInput) {
            nameInput.addEventListener('input', function() {
                console.log('CarouselSettingsControl: Name input changed to:', this.value);
                _this.identityBrandNameValue = this.value;
                if (_this.callbacks && _this.callbacks.setIdentityBrandNameValue) {
                    console.log('CarouselSettingsControl: Calling setIdentityBrandNameValue callback');
                    _this.callbacks.setIdentityBrandNameValue(_this.identityBrandNameValue);
                }
            });
        }

        // Handle Enabled
        const handleEnabled = this.domNode.querySelector('#handleEnabled');
        if (handleEnabled) {
            handleEnabled.addEventListener('change', function() {
                _this.identityBrandHandleEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setIdentityBrandHandleEnabled) {
                    _this.callbacks.setIdentityBrandHandleEnabled(_this.identityBrandHandleEnabled);
                }
            });
        }

        // Handle Input
        const handleInput = this.domNode.querySelector('#handleInput');
        if (handleInput) {
            handleInput.addEventListener('input', function() {
                _this.identityBrandHandleValue = this.value;
                if (_this.callbacks && _this.callbacks.setIdentityBrandHandleValue) {
                    _this.callbacks.setIdentityBrandHandleValue(_this.identityBrandHandleValue);
                }
            });
        }

        // Website Enabled
        const websiteEnabled = this.domNode.querySelector('#websiteEnabled');
        if (websiteEnabled) {
            websiteEnabled.addEventListener('change', function() {
                _this.identityBrandWebsiteEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setIdentityBrandWebsiteEnabled) {
                    _this.callbacks.setIdentityBrandWebsiteEnabled(_this.identityBrandWebsiteEnabled);
                }
            });
        }

        // Website Input
        const websiteInput = this.domNode.querySelector('#websiteInput');
        if (websiteInput) {
            websiteInput.addEventListener('input', function() {
                _this.identityBrandWebsiteValue = this.value;
                if (_this.callbacks && _this.callbacks.setIdentityBrandWebsiteValue) {
                    _this.callbacks.setIdentityBrandWebsiteValue(_this.identityBrandWebsiteValue);
                }
            });
        }

        // Show Intro/Outro
        const showIntroOutro = this.domNode.querySelector('#showIntroOutro');
        if (showIntroOutro) {
            showIntroOutro.addEventListener('change', function() {
                _this.identityBrandShowIntroOutro = this.checked;
                if (_this.callbacks && _this.callbacks.setIdentityBrandShowIntroOutro) {
                    _this.callbacks.setIdentityBrandShowIntroOutro(_this.identityBrandShowIntroOutro);
                }
            });
        }
    }
}

export default CarouselSettingsControl;