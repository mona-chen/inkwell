// Curated Google Fonts library for the typography control. The builder loads the selected font
// into the canvas iframe for live editing, and StyleEngine prepends an @import to the compiled
// styles so published pages (which only keep the body) render the font too.

export const GOOGLE_FONTS = [
    { value: 'Inter', label: 'Inter', weights: '400;500;600;700;800' },
    { value: 'Roboto', label: 'Roboto', weights: '300;400;500;700' },
    { value: 'Open Sans', label: 'Open Sans', weights: '300;400;500;600;700;800' },
    { value: 'Lato', label: 'Lato', weights: '300;400;700;900' },
    { value: 'Montserrat', label: 'Montserrat', weights: '300;400;500;600;700;800;900' },
    { value: 'Poppins', label: 'Poppins', weights: '300;400;500;600;700' },
    { value: 'Oswald', label: 'Oswald', weights: '300;400;500;600;700' },
    { value: 'Raleway', label: 'Raleway', weights: '300;400;500;600;700;800' },
    { value: 'Nunito', label: 'Nunito', weights: '300;400;600;700;800;900' },
    { value: 'Work Sans', label: 'Work Sans', weights: '300;400;500;600;700' },
    { value: 'DM Sans', label: 'DM Sans', weights: '400;500;700' },
    { value: 'Source Sans 3', label: 'Source Sans 3', weights: '300;400;600;700' },
    { value: 'Space Grotesk', label: 'Space Grotesk', weights: '300;400;500;600;700' },
    { value: 'IBM Plex Sans', label: 'IBM Plex Sans', weights: '300;400;500;600;700' },
    { value: 'Playfair Display', label: 'Playfair Display', weights: '400;500;600;700;800;900' },
    { value: 'Merriweather', label: 'Merriweather', weights: '300;400;700;900' },
    { value: 'Lora', label: 'Lora', weights: '400;500;600;700' },
    { value: 'Cormorant Garamond', label: 'Cormorant Garamond', weights: '300;400;500;600;700' },
    { value: 'JetBrains Mono', label: 'JetBrains Mono (Mono)', weights: '400;500;600;700' },
    { value: 'Fira Code', label: 'Fira Code (Mono)', weights: '300;400;500;600;700' },
    { value: 'IBM Plex Mono', label: 'IBM Plex Mono (Mono)', weights: '400;500;600;700' },
];

const BY_NAME = new Map(GOOGLE_FONTS.map((font) => [font.value, font]));

// The @import url(...) fragment for a single font family (CSS2 API).
export function fontImportUrl(family) {
    const font = BY_NAME.get(family);
    const weights = font ? font.weights : '400;500;600;700';
    return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weights}&display=swap`;
}

// Collect distinct Google Font families referenced across a document's element styles.
export function usedFonts(document) {
    const families = new Set();
    const visit = (node) => {
        Object.values(node.styles || {}).forEach((device) => {
            Object.values(device || {}).forEach((state) => {
                const family = state?.['font-family'];
                if (typeof family === 'string' && family && BY_NAME.has(family)) families.add(family);
            });
        });
        (node.children || []).forEach(visit);
    };
    document.data.children.forEach(visit);
    const themeFamily = document.data.settings?.theme?.typography?.fontFamily;
    if (typeof themeFamily === 'string') {
        const primary = themeFamily.split(',')[0].trim().replace(/['"]/g, '');
        if (BY_NAME.has(primary)) families.add(primary);
    }
    return [...families];
}
