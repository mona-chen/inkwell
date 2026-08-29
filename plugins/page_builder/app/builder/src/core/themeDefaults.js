// Ink's page theme is deliberately independent from the editor chrome. These values are
// the initial authored-page palette; element colors still inherit through CSS and explicit
// element/container styles always win.
export const DEFAULT_THEME_COLORS = Object.freeze({
    primary: '#6750ff',
    secondary: '#64748b',
    text: '#1f2328',
    accent: '#8b5cf6',
});

export const DEFAULT_THEME_TYPOGRAPHY = Object.freeze({
    fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif',
    baseSize: 16,
    lineHeight: 1.5,
});

export const DEFAULT_THEME_SPACING = Object.freeze({
    contentWidth: 1140,
    pageGutter: 10,
    sectionGap: 0,
});
