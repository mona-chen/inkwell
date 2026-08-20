class ImageEffectControl {
    constructor(label, value, callback) {
        // Initialize properties
        this.label = label; // Label for the image control
        this.value = value.src; // Initial image URL
        this.current_effects = value.current_effects || {}; // Current effects applied to the image
        this.callback = callback; // Callback function to handle changes

        this.effects = {
            grayscale: [0, 20, 40, 60, 80, 100],      // percentage
            sepia: [0, 20, 40, 60, 80, 100],         // percentage
            invert: [0, 20, 40, 60, 80, 100],        // percentage
            blur: [0, 1, 2, 3, 4, 5, 10],            // px
            brightness: [100, 75, 50, 125, 150, 200],// percentage
            contrast: [100, 75, 50, 125, 150, 200],  // percentage
            saturate: [100, 50, 0, 150, 200, 300],   // percentage
            hueRotate: [0, 30, 60, 90, 120, 180, 270], // degrees
            opacity: [100, 80, 60, 40, 20, 0]        // percentage
        };

        // Effect labels for display
        this.effectLabels = {
            grayscale: 'Grayscale',
            sepia: 'Sepia',
            invert: 'Invert',
            blur: 'Blur',
            brightness: 'Brightness',
            contrast: 'Contrast',
            saturate: 'Saturation',
            hueRotate: 'Hue Rotate',
            opacity: 'Opacity'
        };

        // Effect descriptions
        this.effectDescriptions = {
            grayscale: '🖌️ Converts the image to black and white, with values from 0% (normal) to 100% (completely grayscale).',
            sepia: '🏺 Adds a warm, yellowish-brown tone to create a vintage or antique look.',
            invert: '🔄 Reverses all colors in the image, like a photo negative effect.',
            blur: '🌫️ Creates a soft focus effect, higher values increase the blurriness.',
            brightness: '☀️ Adjusts how bright the image appears, 100% is normal, higher values increase brightness.',
            contrast: '⚖️ Controls the difference between dark and light areas, 100% is normal.',
            saturate: '🌈 Changes color intensity, 100% is normal, higher values make colors more vivid.',
            hueRotate: '🎨 Shifts all colors in the image by rotating them around the color wheel.',
            opacity: '👻 Controls how transparent the image is, 100% is fully visible, 0% is invisible.'
        };

        // Create the main container element
        this.domNode = document.createElement('div');
        this.domNode.className = 'ImageEffectControl';

        // Render control
        this.render();
    };

    render() {
        const current = {
            grayscale: this.current_effects.grayscale ?? 0,
            sepia: this.current_effects.sepia ?? 0,
            invert: this.current_effects.invert ?? 0,
            blur: this.current_effects.blur ?? 0,
            brightness: this.current_effects.brightness ?? 100,
            contrast: this.current_effects.contrast ?? 100,
            saturate: this.current_effects.saturate ?? 100,
            hueRotate: this.current_effects.hueRotate ?? 0,
            opacity: this.current_effects.opacity ?? 100
        };

        const makeOptions = (effect, values) => {
            return values.map((value) => {
                let imgStyle = '';
                if (effect === 'opacity' && value <= 0) {
                    imgStyle = 'visibility: hidden;';
                } else {
                    const filterValue = effect === 'hueRotate' ? 
                        `hue-rotate(${value}deg)` : 
                        `${effect}(${value}${effect === 'blur' ? 'px' : '%'})`;
                    imgStyle = `filter: ${filterValue};`;
                }
                
                return `<span class="ImageEffectControl-thumb${value == current[effect] ? ' ImageEffectControl-selected' : ''}">
                    <img src="${this.value}" 
                        data-effect="${effect}" 
                        data-value="${value}" 
                        style="${imgStyle} width: 56px; height: 56px; border-radius: 6px; cursor: pointer;">
                    <div class="ImageEffectControl-thumbLabel">${value}${effect === 'blur' ? 'px' : effect === 'hueRotate' ? '°' : '%'}</div>
                </span>`;
            }).join('');
        };

        // Create accordion panels for each effect
        const effectPanels = Object.keys(this.effects).map((effect) => {
            const currentValue = current[effect];
            const unit = effect === 'blur' ? 'px' : effect === 'hueRotate' ? '°' : '%';
            
            // Create thumbnail for currently selected value
            const currentThumb = `
                <div class="ImageEffectControl-previewThumb">
                    <img src="${this.value}" 
                        style="filter: ${effect === 'hueRotate' ? 'hue-rotate(' + currentValue + 'deg)' : effect + '(' + currentValue + (effect === 'blur' ? 'px' : '%') + ')'};"> 
                </div>`;
                
            return `
            <div class="ImageEffectControl-panel" data-effect="${effect}">
                <input type="hidden" name="${effect}" value="${currentValue}">
                
                <div class="ImageEffectControl-header">
                    <div class="ImageEffectControl-name">${this.effectLabels[effect]}</div>
                    <div class="ImageEffectControl-current">
                        ${currentThumb}
                        <div class="ImageEffectControl-valueDisplay">
                            <span class="ImageEffectControl-valueNumber">${currentValue}</span>
                            <span class="ImageEffectControl-valueUnit">${unit}</span>
                        </div>
                    </div>
                    <div class="ImageEffectControl-toggle">
                        <span class="ImageEffectControl-arrow"></span>
                    </div>
                </div>
                
                <div class="ImageEffectControl-content">
                    <div class="alert alert-light fst-italic rounded-2 bg-light border-0 mb-3 ImageEffectControl-description">${this.effectDescriptions[effect]}</div>
                    <div class="ImageEffectControl-options" data-effect="${effect}">
                        ${makeOptions(effect, this.effects[effect])}
                    </div>
                </div>
            </div>`;
        }).join('');

        this.domNode.innerHTML = `
        <div class="ImageEffectControl-container">
            <label class="ImageEffectControl-label">${this.label}</label>
            
            <label class="ImageEffectControl-previewLabel">Preview</label>
            <div class="ImageEffectControl-preview" style="background-image: url('${this.value}'); filter: ${this.generateFilterString(current)};"></div>
            
            <div class="ImageEffectControl-actions">
                <button type="button" class="btn btn-secondary ImageEffectControl-resetBtn">Reset Effects</button>
            </div>

            <label class="ImageEffectControl-previewLabel">Effects</label>

            <div class="ImageEffectControl-effectsContainer">
                ${effectPanels}
            </div>
        </div>`;

        // Set up event listeners
        this.setupEffectPanels();
        this.setupOptionClickHandlers();
        this.domNode.querySelector('.ImageEffectControl-resetBtn').onclick = () => this.resetEffects();
    }

    setupEffectPanels() {
        this.domNode.querySelectorAll('.ImageEffectControl-header').forEach(header => {
            header.addEventListener('click', () => {
                const panel = header.closest('.ImageEffectControl-panel');
                const content = panel.querySelector('.ImageEffectControl-content');
                const arrow = header.querySelector('.ImageEffectControl-arrow');
                
                // Close all other panels first
                this.domNode.querySelectorAll('.ImageEffectControl-panel').forEach(p => {
                    if (p !== panel && p.querySelector('.ImageEffectControl-content').classList.contains('ImageEffectControl-open')) {
                        p.classList.remove('ImageEffectControl-active');
                        p.querySelector('.ImageEffectControl-content').classList.remove('ImageEffectControl-open');
                        p.querySelector('.ImageEffectControl-arrow').classList.remove('ImageEffectControl-open');
                    }
                });
                
                // Toggle the active state on the panel
                panel.classList.toggle('ImageEffectControl-active');
                
                // Toggle the open class for animation
                content.classList.toggle('ImageEffectControl-open');
                
                // Change the arrow direction
                arrow.classList.toggle('ImageEffectControl-open');
                
                // Reset animation for thumbnails when reopening a panel
                if (content.classList.contains('ImageEffectControl-open')) {
                    // Trigger a reflow to restart animations
                    const thumbs = content.querySelectorAll('.ImageEffectControl-thumb');
                    thumbs.forEach(thumb => {
                        thumb.style.animation = 'none';
                        thumb.offsetHeight; // Trigger reflow
                        thumb.style.animation = '';
                    });
                }
            });
        });
    }

    setupOptionClickHandlers() {
        this.domNode.querySelectorAll('.ImageEffectControl-options').forEach(optionsDiv => {
            optionsDiv.addEventListener('click', (e) => {
                const thumb = e.target.closest('.ImageEffectControl-thumb');
                if (thumb && thumb.querySelector('img')) {
                    optionsDiv.querySelectorAll('.ImageEffectControl-thumb').forEach(span => {
                        span.classList.remove('ImageEffectControl-selected');
                    });
                    thumb.classList.add('ImageEffectControl-selected');
                    
                    const img = thumb.querySelector('img');
                    const effect = img.dataset.effect;
                    const value = parseInt(img.dataset.value, 10);
                    
                    // Update hidden input
                    this.domNode.querySelector(`input[name=${effect}]`).value = value;
                    
                    // Update the current value display in header
                    const panel = this.domNode.querySelector(`.ImageEffectControl-panel[data-effect="${effect}"]`);
                    const valueDisplay = panel.querySelector('.ImageEffectControl-valueNumber');
                    valueDisplay.textContent = value;
                    
                    // Update the preview thumbnail in header
                    const previewImg = panel.querySelector('.ImageEffectControl-previewThumb img');
                    
                    // Handle 0% opacity specially
                    if (effect === 'opacity' && value <= 0) {
                        previewImg.style.visibility = 'hidden';
                        previewImg.style.filter = '';
                    } else {
                        previewImg.style.visibility = 'visible';
                        previewImg.style.filter = effect === 'hueRotate' ? 
                            `hue-rotate(${value}deg)` : 
                            `${effect}(${value}${effect === 'blur' ? 'px' : '%'})`;
                    }
                    
                    // Update main preview
                    this.updatePreview();
                    
                    // Apply changes immediately
                    this.setEffects();
                }
            });
        });
    }

    generateFilterString(effects) {
        return `grayscale(${effects.grayscale}%) sepia(${effects.sepia}%) invert(${effects.invert}%) blur(${effects.blur}px) brightness(${effects.brightness}%) contrast(${effects.contrast}%) saturate(${effects.saturate}%) hue-rotate(${effects.hueRotate}deg) opacity(${effects.opacity}%)`;
    }

    updatePreview() {
        const effects = {};
        this.domNode.querySelectorAll('input[type="hidden"]').forEach(input => {
            effects[input.name] = parseInt(input.value, 10);
        });
        
        const preview = this.domNode.querySelector('.ImageEffectControl-preview');
        
        // Handle 0% opacity specially
        if (effects.opacity <= 0) {
            preview.style.visibility = 'hidden';
        } else {
            preview.style.visibility = 'visible';
            preview.style.filter = this.generateFilterString(effects);
        }
    }
    
    resetEffects() {
        const defaults = {
            grayscale: 0, sepia: 0, invert: 0, blur: 0,
            brightness: 100, contrast: 100, saturate: 100,
            hueRotate: 0, opacity: 100
        };
        
        Object.entries(defaults).forEach(([effect, value]) => {
            // Update hidden input
            this.domNode.querySelector(`input[name=${effect}]`).value = value;
            
            // Update thumbnail selection
            const optionsDiv = this.domNode.querySelector(`.ImageEffectControl-options[data-effect="${effect}"]`);
            if (optionsDiv) {
                optionsDiv.querySelectorAll('.ImageEffectControl-thumb').forEach(span => {
                    const thumbValue = span.querySelector('img').dataset.value;
                    if (thumbValue == value) {
                        span.classList.add('ImageEffectControl-selected');
                    } else {
                        span.classList.remove('ImageEffectControl-selected');
                    }
                });
            }
            
            // Update current value in header
            const panel = this.domNode.querySelector(`.ImageEffectControl-panel[data-effect="${effect}"]`);
            const valueNumber = panel.querySelector('.ImageEffectControl-valueNumber');
            valueNumber.textContent = value;
            
            // Update preview thumbnail
            const previewImg = panel.querySelector('.ImageEffectControl-previewThumb img');
            previewImg.style.filter = effect === 'hueRotate' ? 
                `hue-rotate(${value}deg)` : 
                `${effect}(${value}${effect === 'blur' ? 'px' : '%'})`;
        });
        
        // Update preview and apply changes
        this.updatePreview();
        this.setEffects();
    }

    setEffects() {
        const effects = {};
        this.domNode.querySelectorAll('input[type="hidden"]').forEach(input => {
            effects[input.name] = parseInt(input.value, 10);
        });
        this.callback.setEffects(effects);
    }
}

export default ImageEffectControl;