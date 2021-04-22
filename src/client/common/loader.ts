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
        const response = await fetch(url, { signal: this.Signal })
        if (this.Aborted) return null
        return await response.json()
    }
}