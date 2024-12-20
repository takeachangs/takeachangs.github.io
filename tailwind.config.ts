import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(69, 91, 100)',    // 60%
        secondary: 'rgb(127, 144, 149)', // 30%
        accent: 'rgb(89, 39, 20)',      // 10%
      },
      fontFamily: {
        montserrat: ['var(--font-montserrat)', 'sans-serif'],
        opensans: ['var(--font-opensans)', 'sans-serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            color: 'rgb(127, 144, 149)',
            h1: {
              color: 'rgb(229, 229, 229)',
            },
            h2: {
              color: 'rgb(229, 229, 229)',
            },
            strong: {
              color: 'rgb(229, 229, 229)',
            },
            code: {
              color: 'rgb(229, 229, 229)',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config