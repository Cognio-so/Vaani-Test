/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      scrollbar: {
        'none': {
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
        'sound-wave': 'soundWave 1.5s infinite ease-in-out',
        'bounce': 'bounce 1s infinite',
        'blink': 'blink 1.5s infinite ease-in-out',
        'shine': 'shine 3s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '100% 0' },
          '100%': { backgroundPosition: '0% 0' }
        },
        soundWave: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(0.5)' }
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' }
        },
        shine: {
          '0%': { 'background-position': '-200% center' },
          '100%': { 'background-position': '200% center' },
        },
      },
      margin: {
        'safe': 'env(safe-area-inset-bottom, 0px)'
      },
      padding: {
        'safe': 'env(safe-area-inset-bottom, 0px)'
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwind-scrollbar-hide')
  ],
}
