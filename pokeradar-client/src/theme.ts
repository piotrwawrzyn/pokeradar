/**
 * Design tokens — single source of truth for the Pikachu Dark theme.
 *
 * CSS counterparts live in index.css (:root). Keep the two files in sync
 * when changing a value: update the constant here, then the matching
 * custom property in index.css (and vice-versa).
 */
export const theme = {
  // Core palette
  background:    'oklch(0.15 0.01 260)',  // --background
  foreground:    'oklch(0.95 0.01 90)',   // --foreground
  card:          'oklch(0.22 0.01 260)',  // --card
  primary:       'oklch(0.82 0.17 85)',   // --primary
  primaryFg:     'oklch(0.16 0.02 60)',   // --primary-foreground
  mutedFg:       'oklch(0.65 0.02 90)',   // --muted-foreground
  border:        'oklch(0.33 0.01 260)',  // --border
  input:         'oklch(0.31 0.01 260)',  // --input
  destructive:   'oklch(0.65 0.22 25)',   // --destructive
  radius:        '0.625rem',             // --radius
  // Derived tokens (not Tailwind utilities — used only by Clerk appearance API)
  primaryHover:  'oklch(0.74 0.15 85)',   // --primary-hover
  primaryLight:  'oklch(0.87 0.17 85)',   // --primary-light
  labelFg:       'oklch(0.80 0.01 90)',   // --label-fg
  borderLight:   'oklch(0.36 0.01 260)', // --border-light
  borderLighter: 'oklch(0.39 0.01 260)', // --border-lighter
  inputHover:    'oklch(0.29 0.01 260)', // --input-hover
  radiusMd:      '0.5rem',              // --radius-md  (calc(0.625rem - 2px))
} as const;
