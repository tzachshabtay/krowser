export class Loader {
    cancelToken: CancelToken | null = null;

    public async Load(fn: (cancelToken: CancelToken) => Promise<void>) {
        this.cancelToken = new CancelToken();
        try {
            await fn(this.cancelToken)
        } catch (error) {
            if (error.name === 'AbortError') {
                return
            }
            throw(error)
        }
        finally {
            this.cancelToken = null
        }
    }

    public Abort() {
        this.cancelToken?.abortController.abort();
    }
}

export class CancelToken {
    abortController: AbortController = new AbortController();

    public get Signal(): AbortSignal {
        return this.abortController.signal
    }

    public get Aborted(): boolean {
        return this.abortController.signal.aborted
    }

    public async Fetch(url: string): Promise<any> {
        try {
            const response = await fetch(url, { signal: this.Signal })
            if (this.Aborted) return null
            try {
                const responseTxt = await response.text()
                try {
                    const body = JSON.parse(responseTxt)
                    if(!body.error && response.status >= 400) {
                        return { error: `fetch from ${url} returned status code ${response.status}, response: ${responseTxt}` }
                    }
                    return body
                } catch (jsonErr) {
                    if (this.Aborted) return null
                    console.warn(`unable to parse response json:`, jsonErr)
                    return { error: `fetch from ${url} returned status code ${response.status}, text: ${responseTxt}`}
                }
            } catch (txtErr) {
                if (this.Aborted) return null
                console.warn(`unable to parse response text:`, txtErr)
                return { error: `fetch from ${url} returned status code ${response.status}`}
            }
        } catch (error) {
            if (this.Aborted) return null
            return { error: `fetch from ${url} errored: ${error}`}
        }
    }
}