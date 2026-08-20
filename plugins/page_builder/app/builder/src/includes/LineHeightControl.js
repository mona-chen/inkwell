class LetterSpacingControl {
  constructor(label, value, callback) {
    this.id = "_" + Math.random().toString(36).substr(2, 9);
    // Initialize properties
    this.label = label; // Label for the text control
    this.value = value; // Initial /* left | center | right */
    this.callback = callback; // Callback function to handle input changes

    this.options = [
      {name: "Line 1.2", value: 1.2, icon: "density_small"},
      {name: "Line 1.5", value: 1.5, icon: "dehaze"},
      {name: "Line 1.8", value: 1.8, icon: "equal"},
      {name: "Line 2", value: 2, icon: "density_large"}
    ];

    // Create the main container element
    this.domNode = document.createElement("div");

    this.render(); // Call the render method to create the UI
  }

  render() {
    // build dropdown using Bootstrap markup so icons render inside options
    const itemsHtml = this.options.map(option => `
        <button class="dropdown-item lh-dropdown-item d-flex align-items-center" type="button" data-value="${option.value}">
          <span class="material-symbols-rounded me-2">${option.icon}</span>
          <span class="lh-name">${option.name}</span>
        </button>
      `).join('');

    // compute selected icon/label from options so toggle shows correct icon initially
    const selectedOpt = this.options.find(o => String(o.value) === String(this.value));
    const selectedIcon = selectedOpt ? selectedOpt.icon : '';
    const selectedLabel = selectedOpt ? selectedOpt.name : (this.value || 'Select');

  this.domNode.innerHTML =
  `<div class="py-2 ps-3 pe-3 w-100">
    <div class="d-flex align-items-center justify-content-between">
      <label class="form-label fw-semibold mb-0 me-3">${this.label}</label>

      <div class="dropdown">
        <button class="btn btn-outline-secondary dropdown-toggle d-flex align-items-center" type="button" id="dropdownLine_${this.id}" data-bs-toggle="dropdown" aria-expanded="false">
          <span class="material-symbols-rounded me-2">${selectedIcon}</span>
          <span class="dropdown-selected">${selectedLabel}</span>
        </button>
        <div class="dropdown-menu shadow-sm" aria-labelledby="dropdownLine_${this.id}">
          ${itemsHtml}
          <div><hr class="dropdown-divider"></div>
          <button class="dropdown-item lh-dropdown-item d-flex align-items-center" type="button" data-value="__custom__">
            <span class="material-symbols-rounded me-2">edit</span>
            <span class="lh-name">Custom</span>
          </button>
        </div>
      </div>
    </div>
    <div class="d-flex w-100 justify-content-end my-2" id="customLineHeight_${this.id}">
        <div class="input-group flex-nowrap w-25" role="group" aria-label="${this.label}" style="min-width:125px">
          <button class="btn btn-outline-secondary" role="reduction" type="button">-</button>
          <input id="${this.id}" value="${this.value}" class="form-control text-center" readonly style="width:70px;max-width:70px">
          <button class="btn btn-outline-secondary" role="increment" type="button">+</button>
        </div>
      </div>
    </div>`;
  const decrease = this.domNode.querySelector('[role="reduction"]');
  const increase = this.domNode.querySelector('[role="increment"]');
  const input = this.domNode.querySelector(`#${this.id}`);
  const custom = this.domNode.querySelector(`#customLineHeight_${this.id}`);

  // Simple hide/show functions
  const showCustom = () => {
    if (custom) {
      custom.style.height = 'auto';
      custom.style.overflow = 'visible';
      custom.style.opacity = '1';
    }
  };

  const hideCustom = () => {
    if (custom) {
      custom.style.height = '0';
      custom.style.overflow = 'hidden';
      custom.style.opacity = '0';
    }
  };

  // Hide custom area by default
  hideCustom();

    // wire dropdown items
    const dropdown = this.domNode.querySelector('.dropdown');
    if (dropdown) {
      const menu = dropdown.querySelector('.dropdown-menu');
      const selectedSpan = dropdown.querySelector('.dropdown-selected');
      const selectedIconSpan = dropdown.querySelector('.material-symbols-rounded');

      menu.querySelectorAll('.lh-dropdown-item').forEach(opt => {
        opt.addEventListener('click', (e) => {
          const val = opt.getAttribute('data-value');
          
          if (val === '__custom__') {
            // Show custom input area
            showCustom();
            // Sync input with current value and focus it
            if (custom) {
              const customInput = custom.querySelector('input');
              if (customInput) {
                customInput.value = this.value;
                try { customInput.focus(); } catch (e) {}
              }
            }
          } else {
            // Hide custom area and set the selected value
            hideCustom();
            this.setValue(parseFloat(val));
          }
          
          // Update dropdown toggle label/icon
          const iconSpan = opt.querySelector('.material-symbols-rounded');
          if (selectedIconSpan && iconSpan) selectedIconSpan.textContent = iconSpan.textContent;
          if (selectedSpan) selectedSpan.textContent = opt.querySelector('.lh-name').textContent;
        });
      });
    }

    // Only show custom area if initial value is '__custom__'
    if (String(this.value) === '__custom__') {
      showCustom();
    }

    const changeValue = (delta) => {
      let numeric = parseFloat(this.value) || 1.0;
      numeric = Math.max(0.1, +(numeric + delta).toFixed(1));
      this.setValue(numeric);
    };

    if (decrease) {
      decrease.addEventListener('click', (e) => {
        e.preventDefault();
        changeValue(-0.1);
      });
    }

    if (increase) {
      increase.addEventListener('click', (e) => {
        e.preventDefault();
        changeValue(0.1);
      });
    }

    // allow direct programmatic update keeping UI in sync
    this._inputNode = input;
  }

  afterRender() {}

// Method to set value programmatically
  setValue(newValue) {
    this.value = newValue;

    const input = this.domNode.querySelector('input');
    if (input) {
      input.value = this.value;
    }

    // Support both function and object with setValue
    if (typeof this.callback === 'function') {
      this.callback(this.value);
    } else if (
      this.callback &&
      typeof this.callback.setValue === 'function'
    ) {
      this.callback.setValue(this.value);
    }
  }
  
  // Method to get current value
  getValue() {
    return this.value;
  }
}

export default LetterSpacingControl;
