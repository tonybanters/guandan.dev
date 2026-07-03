export const tokyo = {
    bg: '#15161e',
    panel: '#1a1b26',
    fg: '#c0caf5',
    muted: '#a9b1d6',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
} as const

export const tokyo_fg_a = (a: number) => `rgba(192, 202, 245, ${a})`
export const tokyo_muted_a = (a: number) => `rgba(169, 177, 214, ${a})`
export const tokyo_green_a = (a: number) => `rgba(158, 206, 106, ${a})`
export const tokyo_yellow_a = (a: number) => `rgba(224, 175, 104, ${a})`
