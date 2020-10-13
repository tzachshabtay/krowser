import qs = require('qs');

export type UrlProperty = `raw` | `search` | `offset` | `limit` | `searchFrom` | `topics`

export class Url {
    obj: qs.ParsedQs

    public BaseUrl: string

    constructor(location: string, baseUrl: string) {
        if (location.startsWith("?")) {
            location = location.substring(1)
        }
        this.obj = qs.parse(location)
        this.BaseUrl = baseUrl
    }

    public Get(name: UrlProperty): string | undefined {
        return this.obj[name]?.toString() || undefined
    }

    public Set(...props: {name: UrlProperty, val: string}[]) {
        for (const prop of props) {
            if (prop.val) {
                this.obj[prop.name] = prop.val
            } else {
                delete this.obj[prop.name]
            }
        }

        const url = `${this.BaseUrl}?${qs.stringify(this.obj)}`

        //We're using window.history and not the router history because we don't want to navigate away, this is just for sharing url purposes.
        window.history.replaceState(null, document.title, url)
    }
}