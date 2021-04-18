export type SearchStyle = `case-sensitive` | `regex` | ``

export function Includes(text: string, pattern: string, searchStyle: SearchStyle): boolean {
    switch (searchStyle) {
        case `case-sensitive`:
            return text.includes(pattern)
        case `regex`:
            try {
                const re = new RegExp(pattern)
                return re.test(text)
            } catch (SyntaxError) {
                return false
            }
        default:
            return text.toLowerCase().includes(pattern.toLowerCase())
    }
}