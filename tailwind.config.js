/** Design tokens extracted from the Stitch "Precision Fiscal" design system.
 *  Source of truth: design/DESIGN.md + design/html/*.html
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
          "error-container": "#ffdad6",
          "on-background": "#131b2e",
          "on-secondary-fixed-variant": "#224e47",
          "surface": "#faf8ff",
          "outline": "#6e7977",
          "surface-tint": "#006a63",
          "inverse-primary": "#80d5cb",
          "tertiary-container": "#007a33",
          "on-secondary-fixed": "#00201c",
          "surface-container": "#eaedff",
          "tertiary-fixed": "#7ffc97",
          "error": "#ba1a1a",
          "on-surface": "#131b2e",
          "on-tertiary-fixed": "#002109",
          "on-primary-fixed-variant": "#00504a",
          "on-surface-variant": "#3e4947",
          "secondary-fixed": "#bdece2",
          "on-tertiary-fixed-variant": "#005320",
          "secondary-container": "#bdece2",
          "primary-fixed-dim": "#80d5cb",
          "on-tertiary": "#ffffff",
          "outline-variant": "#bdc9c6",
          "tertiary": "#005f26",
          "on-tertiary-container": "#a1ffad",
          "primary-container": "#0f766e",
          "secondary": "#3b665f",
          "on-secondary-container": "#416c65",
          "on-primary-fixed": "#00201d",
          "surface-bright": "#faf8ff",
          "surface-container-low": "#f2f3ff",
          "surface-container-lowest": "#ffffff",
          "surface-container-high": "#e2e7ff",
          "surface-variant": "#dae2fd",
          "on-primary": "#ffffff",
          "secondary-fixed-dim": "#a2d0c6",
          "surface-dim": "#d2d9f4",
          "on-primary-container": "#a3faef",
          "inverse-surface": "#283044",
          "primary": "#005c55",
          "on-secondary": "#ffffff",
          "on-error": "#ffffff",
          "surface-container-highest": "#dae2fd",
          "inverse-on-surface": "#eef0ff",
          "on-error-container": "#93000a",
          "tertiary-fixed-dim": "#62df7d",
          "background": "#faf8ff",
          "primary-fixed": "#9cf2e8"
        },
      borderRadius: {
          "DEFAULT": "0.25rem",
          "lg": "0.5rem",
          "xl": "0.75rem",
          "full": "9999px"
        },
      spacing: {
          "gutter": "1.5rem",
          "space-lg": "1.5rem",
          "space-sm": "0.75rem",
          "margin": "2rem",
          "space-xl": "2rem",
          "space-xs": "0.5rem",
          "space-md": "1rem"
        },
      fontFamily: {
          "numeric-data": [
            "Inter"
          ],
          "body-sm": [
            "Inter"
          ],
          "body-lg": [
            "Inter"
          ],
          "headline-sm": [
            "Inter"
          ],
          "headline-lg": [
            "Inter"
          ],
          "headline-md": [
            "Inter"
          ],
          "label-sm": [
            "Inter"
          ],
          "body-md": [
            "Inter"
          ],
          "label-md": [
            "Inter"
          ]
        },
      fontSize: {
          "numeric-data": [
            "14px",
            {
              "lineHeight": "20px",
              "fontWeight": "500"
            }
          ],
          "body-sm": [
            "13px",
            {
              "lineHeight": "18px",
              "fontWeight": "400"
            }
          ],
          "body-lg": [
            "15px",
            {
              "lineHeight": "22px",
              "fontWeight": "400"
            }
          ],
          "headline-sm": [
            "18px",
            {
              "lineHeight": "24px",
              "letterSpacing": "-0.01em",
              "fontWeight": "600"
            }
          ],
          "headline-lg": [
            "28px",
            {
              "lineHeight": "36px",
              "letterSpacing": "-0.02em",
              "fontWeight": "600"
            }
          ],
          "headline-md": [
            "20px",
            {
              "lineHeight": "28px",
              "letterSpacing": "-0.015em",
              "fontWeight": "600"
            }
          ],
          "label-sm": [
            "12px",
            {
              "lineHeight": "16px",
              "letterSpacing": "0.01em",
              "fontWeight": "500"
            }
          ],
          "body-md": [
            "14px",
            {
              "lineHeight": "20px",
              "fontWeight": "400"
            }
          ],
          "label-md": [
            "14px",
            {
              "lineHeight": "20px",
              "fontWeight": "500"
            }
          ]
        },
    },
  },
  plugins: [],
}
