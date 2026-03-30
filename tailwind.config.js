/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        mono:    ["'IBM Plex Mono'", "'DM Mono'", 'monospace'],
        display: ["'IBM Plex Mono'", 'monospace'],
        sans:    ["'DM Sans'", 'sans-serif'],
      },
      colors: {
        bg:      '#07090d',
        surface: '#0c0f16',
        s2:      '#111720',
        s3:      '#161e2a',
        border:  '#1c2638',
        border2: '#243044',
        accent:  '#00ff88',
        cyan:    '#00e5ff',
        warn:    '#f0b429',
        danger:  '#ff3355',
        mau:     '#00ff88',
        juani:   '#00e5ff',
      },
    },
  },
  plugins: [],
}
