import qs = require('qs');

export type UrlProperty = `raw` | `search` | `offset` | `limit` | `searchFrom` | `from_time` | `to_time` | `search_by`

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
        this.Refresh()
    }

    public Refresh() {
        const query = qs.stringify(this.obj)
        const url = query ? `${this.BaseUrl}?${query}` : this.BaseUrl

        //We're using window.history and not the router history because we don't want to navigate away, this is just for sharing url purposes.
        window.history.replaceState(null, document.title, url)
    }
}