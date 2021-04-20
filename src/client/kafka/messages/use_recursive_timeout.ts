import { useEffect, useRef } from "react";

//aaron-powell.com/posts/2019-09-23-recursive-settimeout-with-react-hooks/
function useRecursiveTimeout<T>(
    callback: (() => Promise<T>) | (() => void),
    delay: number | null,
    searchId: number
) {
    const savedCallback = useRef(callback);
    const savedDelay = useRef(delay);
    const savedSearchId = useRef(searchId);

    // Remember the latest callback.
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Remember the latest delay.
    useEffect(() => {
        savedDelay.current = delay;
    }, [delay]);

    // Remember the latest search id.
    useEffect(() => {
        savedSearchId.current = searchId;
    }, [searchId])

    // Set up the timeout loop.
    useEffect(() => {
        let id: NodeJS.Timeout;
        function tick() {
            if (savedSearchId.current != searchId) {
                return
            }
            const ret = savedCallback.current();
            if (ret instanceof Promise) {
                ret.then(() => {
                    if (savedSearchId.current != searchId) {
                        return
                    }
                    if (savedDelay.current !== null) {
                        id = global.setTimeout(tick, savedDelay.current);
                    }
                });
            } else {
                if (savedSearchId.current != searchId) {
                    return
                }
                if (savedDelay.current !== null) {
                    id = global.setTimeout(tick, savedDelay.current);
                }
            }
        }
        if (savedDelay.current !== null) {
            id = global.setTimeout(tick, savedDelay.current);
            return () => id && clearTimeout(id);
        }
    }, [delay]);
}

export default useRecursiveTimeout;
