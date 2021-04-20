import { Url } from "./url";
import { SearchStyle } from "../../shared/search";
import { useEffect, useState } from "react";

export type Search = {
    pattern: string
    style: SearchStyle
}

export function UseSearch(url: Url): Search {
    function getSearch() : Search {
        return {
            pattern: url.Get(`search`) || ``,
            style: (url.Get(`search_style`) || ``) as SearchStyle
        }
    }
    const [search, setSearch] = useState<Search>(getSearch())
    useEffect(() => {
        function onUrlChanged(_: string) {
            setSearch(getSearch())
        }
        url.Subscribe(onUrlChanged)
        return function cleanup() {
            url.Unsubscribe(onUrlChanged)
        }
    })
    return search
}