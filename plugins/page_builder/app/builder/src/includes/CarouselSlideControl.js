class CarouselSlideControl {
    constructor(values, callbacks) {
        console.log('CarouselSlideControl: Constructor called with values:', values);
        console.log('CarouselSlideControl: Constructor called with callbacks:', Object.keys(callbacks || {}));
        this.id = '_' + Math.random().toString(36).substr(2, 9);
        // Initialize properties
        this.values = values; // Initial values for the carousel settings
        this.callbacks = callbacks; // Hash of callback functions to handle changes
        
        // controll attributes - flat structure initialization from passed values
        
        // Intro Type Settings
        this.selectedEmoji = this.values.selectedEmoji || '';
        this.headshotPosition = this.values.headshotPosition || 'center';
        this.headshotSize = this.values.headshotSize || 'medium';
        this.headshotBorderStyle = this.values.headshotBorderStyle || 'circle';
        this.headshotBorderColor = this.values.headshotBorderColor || '#6f42c1';
        this.imageType = this.values.imageType || '3d-icon';
        this.imageDescription = this.values.imageDescription || '';
        
        // General Settings
        this.taglineEnabled = this.values.taglineEnabled !== undefined ? this.values.taglineEnabled : true;
        this.tagline = this.values.tagline || 'And you will read this last';
        this.titleEnabled = this.values.titleEnabled !== undefined ? this.values.titleEnabled : true;
        this.titleText = this.values.titleText || 'You will read this first';
        this.paragraphEnabled = this.values.paragraphEnabled !== undefined ? this.values.paragraphEnabled : true;
        this.paragraphText = this.values.paragraphText || 'Then you will read this.';
        this.swipeIndicatorEnabled = this.values.swipeIndicatorEnabled !== undefined ? this.values.swipeIndicatorEnabled : true;
        this.swipeIndicatorText = this.values.swipeIndicatorText || 'Swipe';
        
        // Alignment Settings
        this.imageAlignment = this.values.imageAlignment || 'center';
        
        // Background Image Settings
        this.backgroundImageEnabled = this.values.backgroundImageEnabled !== undefined ? this.values.backgroundImageEnabled : false;
        this.backgroundImageKeywords = this.values.backgroundImageKeywords || '';
        this.backgroundImageOpacity = this.values.backgroundImageOpacity || 75;
        this.applyBackgroundToAllSlides = this.values.applyBackgroundToAllSlides !== undefined ? this.values.applyBackgroundToAllSlides : false;
        // ... initialize other attributes similarly

        //
        this.render(); // Call the render method to create the UI
    }

    render() {
        console.log('CarouselSlideControl: render() called');
        if (!this.domNode) {
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'CarouselSlideControl');
        }

        // render control html
        console.log('CarouselSlideControl: Rendering template with current values');
        this.domNode.innerHTML = builder.renderTemplate('CarouselSlideControl', {
            // Pass current values to template for initial state - flat structure
            
            // Intro Type Settings
            selectedEmoji: this.selectedEmoji,
            headshotPosition: this.headshotPosition,
            headshotSize: this.headshotSize,
            headshotBorderStyle: this.headshotBorderStyle,
            headshotBorderColor: this.headshotBorderColor,
            imageType: this.imageType,
            imageDescription: this.imageDescription,
            
            // General Settings
            taglineEnabled: this.taglineEnabled,
            tagline: this.tagline,
            titleEnabled: this.titleEnabled,
            titleText: this.titleText,
            paragraphEnabled: this.paragraphEnabled,
            paragraphText: this.paragraphText,
            swipeIndicatorEnabled: this.swipeIndicatorEnabled,
            swipeIndicatorText: this.swipeIndicatorText,
            
            // Alignment Settings
            imageAlignment: this.imageAlignment,
            
            // Background Image Settings
            backgroundImageEnabled: this.backgroundImageEnabled,
            backgroundImageKeywords: this.backgroundImageKeywords,
            backgroundImageOpacity: this.backgroundImageOpacity,
            applyBackgroundToAllSlides: this.applyBackgroundToAllSlides
        });

        // Add event listeners for the controls
        this.setupEventListeners();

        console.log('CarouselSlideControl: render() completed');
    }

    afterRender() {
        var _this = this;
    }

    setupEventListeners() {
        var _this = this;

        // Emoji selection
        const emojiButtons = this.domNode.querySelectorAll('[data-emoji]');
        emojiButtons.forEach(button => {
            button.addEventListener('click', function() {
                _this.selectedEmoji = this.getAttribute('data-emoji');
                // Remove selected class from all buttons
                emojiButtons.forEach(btn => btn.classList.remove('selected'));
                // Add selected class to clicked button
                this.classList.add('selected');
                if (_this.callbacks && _this.callbacks.setSelectedEmoji) {
                    _this.callbacks.setSelectedEmoji(_this.selectedEmoji);
                }
            });
        });

        // Headshot settings
        const headshotPosition = this.domNode.querySelector('#headshotPosition');
        if (headshotPosition) {
            headshotPosition.addEventListener('change', function() {
                _this.headshotPosition = this.value;
                if (_this.callbacks && _this.callbacks.setHeadshotPosition) {
                    _this.callbacks.setHeadshotPosition(_this.headshotPosition);
                }
            });
        }

        const headshotSize = this.domNode.querySelector('#headshotSize');
        if (headshotSize) {
            headshotSize.addEventListener('change', function() {
                _this.headshotSize = this.value;
                if (_this.callbacks && _this.callbacks.setHeadshotSize) {
                    _this.callbacks.setHeadshotSize(_this.headshotSize);
                }
            });
        }

        const headshotBorderStyle = this.domNode.querySelector('#headshotBorderStyle');
        if (headshotBorderStyle) {
            headshotBorderStyle.addEventListener('change', function() {
                _this.headshotBorderStyle = this.value;
                if (_this.callbacks && _this.callbacks.setHeadshotBorderStyle) {
                    _this.callbacks.setHeadshotBorderStyle(_this.headshotBorderStyle);
                }
            });
        }

        const headshotBorderColor = this.domNode.querySelector('#headshotBorderColor');
        if (headshotBorderColor) {
            headshotBorderColor.addEventListener('change', function() {
                _this.headshotBorderColor = this.value;
                if (_this.callbacks && _this.callbacks.setHeadshotBorderColor) {
                    _this.callbacks.setHeadshotBorderColor(_this.headshotBorderColor);
                }
            });
        }

        // Image generation settings
        const imageTypeSelect = this.domNode.querySelector('#imageTypeSelect');
        if (imageTypeSelect) {
            imageTypeSelect.addEventListener('change', function() {
                _this.imageType = this.value;
                if (_this.callbacks && _this.callbacks.setImageType) {
                    _this.callbacks.setImageType(_this.imageType);
                }
            });
        }

        const imageDescriptionInput = this.domNode.querySelector('#imageDescriptionInput');
        if (imageDescriptionInput) {
            imageDescriptionInput.addEventListener('input', function() {
                _this.imageDescription = this.value;
                if (_this.callbacks && _this.callbacks.setImageDescription) {
                    _this.callbacks.setImageDescription(_this.imageDescription);
                }
            });
        }

        // Image alignment
        const alignmentButtons = this.domNode.querySelectorAll('input[name="imageAlignment"]');
        alignmentButtons.forEach(button => {
            button.addEventListener('change', function() {
                if (this.checked) {
                    _this.imageAlignment = this.value;
                    if (_this.callbacks && _this.callbacks.setImageAlignment) {
                        _this.callbacks.setImageAlignment(_this.imageAlignment);
                    }
                }
            });
        });

        // General settings toggles and inputs
        const taglineToggle = this.domNode.querySelector('#taglineToggle');
        if (taglineToggle) {
            taglineToggle.addEventListener('change', function() {
                _this.taglineEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setTaglineEnabled) {
                    _this.callbacks.setTaglineEnabled(_this.taglineEnabled);
                }
            });
        }

        const taglineInput = this.domNode.querySelector('#taglineInput');
        if (taglineInput) {
            taglineInput.addEventListener('input', function() {
                _this.tagline = this.value;
                if (_this.callbacks && _this.callbacks.setTagline) {
                    _this.callbacks.setTagline(_this.tagline);
                }
            });
        }

        const titleToggle = this.domNode.querySelector('#titleToggle');
        if (titleToggle) {
            titleToggle.addEventListener('change', function() {
                _this.titleEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setTitleEnabled) {
                    _this.callbacks.setTitleEnabled(_this.titleEnabled);
                }
            });
        }

        const titleInput = this.domNode.querySelector('#titleInput');
        if (titleInput) {
            titleInput.addEventListener('input', function() {
                _this.titleText = this.value;
                if (_this.callbacks && _this.callbacks.setTitleText) {
                    _this.callbacks.setTitleText(_this.titleText);
                }
            });
        }

        const paragraphToggle = this.domNode.querySelector('#paragraphToggle');
        if (paragraphToggle) {
            paragraphToggle.addEventListener('change', function() {
                _this.paragraphEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setParagraphEnabled) {
                    _this.callbacks.setParagraphEnabled(_this.paragraphEnabled);
                }
            });
        }

        const paragraphInput = this.domNode.querySelector('#paragraphInput');
        if (paragraphInput) {
            paragraphInput.addEventListener('input', function() {
                _this.paragraphText = this.value;
                if (_this.callbacks && _this.callbacks.setParagraphText) {
                    _this.callbacks.setParagraphText(_this.paragraphText);
                }
            });
        }

        const swipeIndicatorToggle = this.domNode.querySelector('#swipeIndicatorToggle');
        if (swipeIndicatorToggle) {
            swipeIndicatorToggle.addEventListener('change', function() {
                _this.swipeIndicatorEnabled = this.checked;
                if (_this.callbacks && _this.callbacks.setSwipeIndicatorEnabled) {
                    _this.callbacks.setSwipeIndicatorEnabled(_this.swipeIndicatorEnabled);
                }
            });
        }

        const swipeIndicatorInput = this.domNode.querySelector('#swipeIndicatorInput');
        if (swipeIndicatorInput) {
            swipeIndicatorInput.addEventListener('input', function() {
                _this.swipeIndicatorText = this.value;
                if (_this.callbacks && _this.callbacks.setSwipeIndicatorText) {
                    _this.callbacks.setSwipeIndicatorText(_this.swipeIndicatorText);
                }
            });
        }

        // Background image settings
        const backgroundImageToggle = this.domNode.querySelector('#backgroundImageToggle');
        if (backgroundImageToggle) {
            backgroundImageToggle.addEventListener('change', function() {
                _this.backgroundImageEnabled = this.checked;
                // Show/hide background image content
                const content = _this.domNode.querySelector('#backgroundImageContent');
                if (content) {
                    content.style.display = this.checked ? 'block' : 'none';
                }
                if (_this.callbacks && _this.callbacks.setBackgroundImageEnabled) {
                    _this.callbacks.setBackgroundImageEnabled(_this.backgroundImageEnabled);
                }
            });
        }

        const backgroundImageKeywords = this.domNode.querySelector('#backgroundImageKeywords');
        if (backgroundImageKeywords) {
            backgroundImageKeywords.addEventListener('input', function() {
                _this.backgroundImageKeywords = this.value;
                if (_this.callbacks && _this.callbacks.setBackgroundImageKeywords) {
                    _this.callbacks.setBackgroundImageKeywords(_this.backgroundImageKeywords);
                }
            });
        }

        const backgroundImageOpacity = this.domNode.querySelector('#backgroundImageOpacity');
        if (backgroundImageOpacity) {
            backgroundImageOpacity.addEventListener('input', function() {
                _this.backgroundImageOpacity = parseInt(this.value);
                if (_this.callbacks && _this.callbacks.setBackgroundImageOpacity) {
                    _this.callbacks.setBackgroundImageOpacity(_this.backgroundImageOpacity);
                }
            });
        }

        const applyToAllSlides = this.domNode.querySelector('#applyToAllSlides');
        if (applyToAllSlides) {
            applyToAllSlides.addEventListener('change', function() {
                _this.applyBackgroundToAllSlides = this.checked;
                if (_this.callbacks && _this.callbacks.setApplyBackgroundToAllSlides) {
                    _this.callbacks.setApplyBackgroundToAllSlides(_this.applyBackgroundToAllSlides);
                }
            });
        }

        // Button event listeners
        const generateImageBtn = this.domNode.querySelector('#generateImageBtn');
        if (generateImageBtn) {
            generateImageBtn.addEventListener('click', function() {
                if (_this.callbacks && _this.callbacks.generateImage) {
                    _this.callbacks.generateImage(_this.imageDescription, _this.imageType);
                }
            });
        }

        const backgroundImageSearchBtn = this.domNode.querySelector('#backgroundImageSearchBtn');
        if (backgroundImageSearchBtn) {
            backgroundImageSearchBtn.addEventListener('click', function() {
                if (_this.callbacks && _this.callbacks.searchBackgroundImage) {
                    _this.callbacks.searchBackgroundImage(_this.backgroundImageKeywords);
                }
            });
        }

        const backgroundImageGenerateBtn = this.domNode.querySelector('#backgroundImageGenerateBtn');
        if (backgroundImageGenerateBtn) {
            backgroundImageGenerateBtn.addEventListener('click', function() {
                if (_this.callbacks && _this.callbacks.generateBackgroundImage) {
                    _this.callbacks.generateBackgroundImage(_this.backgroundImageKeywords);
                }
            });
        }

        const backgroundImageUploadBtn = this.domNode.querySelector('#backgroundImageUploadBtn');
        if (backgroundImageUploadBtn) {
            backgroundImageUploadBtn.addEventListener('click', function() {
                if (_this.callbacks && _this.callbacks.uploadBackgroundImage) {
                    _this.callbacks.uploadBackgroundImage();
                }
            });
        }
    }
}

export default CarouselSlideControl;