import React from "react";
import TextField from '@material-ui/core/TextField';
import LinearProgress from '@material-ui/core/LinearProgress';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import Toolbar from '@material-ui/core/Toolbar';
import MenuItem from '@material-ui/core/MenuItem';
import Fade from '@material-ui/core/Fade';
import { GoButton } from './go_button';
import { ErrorMsg} from '../../common/error_msg';
import { Url } from '../../common/url';
import { SearchStyle } from '../../../shared/search';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { GetTopicMessagesResult, GetTopicOffsetsByTimestapResult, GetTopicOffsetsResult, TopicOffsets } from "../../../shared/api";
import { CancelToken, Loader } from "../../common/loader";

export type SearchBy = "offset" | "time" | "newest" | "oldest";

export const AllPartitions = `all`;

export type Progress = {
    min: number;
    max: number;
    from: number;
    to: number;
    partition: string;
    topic: string;
}

interface Props {
    url: Url;
    updateUrl: () => void;
    onError: (error: string) => void;
    scope: React.ReactNode;
    topics: string[];
    partition: string;
    offset?: number;
    limit?: number;
    fromTime?: string;
    toTime?: string;
    searchBy: SearchBy;
    onDataFetched: (data: FetchData) => void;
    onDataFetchStarted: (partition: string) => void;
    onDataFetchCompleted: () => void;
    loadingMessages: boolean;
    error: string;
    errorPrefix: string;
}

type State = {
    search: string;
    searchStyle: SearchStyle;
    searchBy: SearchBy;
    offset: number | "";
    limit: number | "";
    fromTime: string;
    toTime: string;
    progress: Progress;
}

export type FetchData = GetTopicMessagesResult | null;

interface InputProps{
    label: string;
    value: number | "";
    onChange?: any;
    onEnter: () => {};
}

const InputField: React.FunctionComponent<InputProps> = (props) => {
    return (
        <TextField
            label={props.label}
            type="number"
            value={props.value}
            onChange={props.onChange}
            onKeyDown={(e) => {
                if (e.key === "Enter") props.onEnter()
            }}
            margin="normal"
            inputProps={{ min: "0", step: "1" }}
            style={{ marginRight: 10, maxWidth: 100 }}
            error={props.value === ""}
            helperText={props.value === "" ? "Cannot be empty" : ""}
        />
    )
}

interface DateTimeInputProps{
    label: string;
    value: string;
    onChange?: any;
    onEnter: () => {};
}

const DateTimeField: React.FunctionComponent<DateTimeInputProps> = (props) => {
    return (
        <TextField
            label={props.label}
            type="datetime-local"
            value={props.value}
            onChange={props.onChange}
            onKeyDown={(e) => {if (e.key === "Enter") props.onEnter()}}
            margin="normal"
            style={{ marginRight: 10, maxWidth: 300 }}
            InputLabelProps={{
                shrink: true,
            }}
        />
    )
}

export class Fetcher extends React.Component<Props, State> {
    state: State = {
        search: "",
        searchStyle: "",
        offset: this.props.offset ?? 0,
        limit: this.props.limit ?? 5,
        fromTime: this.props.fromTime ?? "",
        toTime: this.props.toTime ?? "",
        searchBy: this.props.searchBy ?? `offset`,
        progress: {
            min: 0,
            max: 0,
            from: 0,
            to: 0,
            partition: "",
            topic: "",
        },
    }
    loader: Loader = new Loader()

    setStateAsync = (updater: any) => new Promise((resolve: any)=> this.setState(updater, resolve))

    async componentDidMount() {
        this.updateUrl()
        await this.fetchData(this.preloadMessages)
    }

    componentWillUnmount() {
        this.props.url.Unsubscribe(this.onUrlChanged)
        this.loader.Abort()
    }

    fetchData = async (fn: (cancelToken: CancelToken) => Promise<void>) => {
        try {
            this.props.onDataFetchStarted(this.props.partition)
            await this.loader.Load(fn)
        } finally {
            this.props.onDataFetchCompleted()
        }
    }

    preloadMessages = async (cancelToken: CancelToken) => {
        await this.updateSearch()
        if (cancelToken.Aborted) return
        this.props.url.Subscribe(this.onUrlChanged)
        let timeout = 10000
        if (this.state.limit && this.state.limit > 100) {
            timeout = 20000
        }
        await this.fetchMessages(timeout, cancelToken)
    }

    onFetchMessagesClicked = async () => {
        await this.fetchData(this.loadMessages)
    }

    loadMessages = async (cancelToken: CancelToken) => {
        await this.fetchMessages(20000, cancelToken)
    }

    async updateSearch() {
        const search = this.props.url.Get(`search`) || ``
        const searchStyle = (this.props.url.Get(`search_style`) || ``) as SearchStyle
        await this.setState({search, searchStyle})
    }

    onUrlChanged = (_: string) => {
        this.updateSearch()
    }

    getOffsetForTime = async (topic: string, partition: number, time: string, cancelToken: CancelToken): Promise<number | undefined> => {
        const millis = new Date(time).getTime();
        const data: GetTopicOffsetsByTimestapResult = await cancelToken.Fetch(`/api/offsets/${topic}/${millis}`)
        if (cancelToken.Aborted) {
            return undefined
        }
        if (data.error) {
            this.props.onError(data.error)
            return undefined
        }
        const result = parseInt(data.find((item: { partition: number; }) => item.partition === partition)?.offset ?? "0")
        return result
    }

    getSelectedPartitions = async(topic: string, cancelToken: CancelToken): Promise<number[]> => {
        if (this.props.partition !== AllPartitions) {
            return [parseInt(this.props.partition)]
        }
        return await this.getAllPartitionsForTopic(topic, cancelToken)
    }

    getAllPartitionsForTopic = async(topic: string, cancelToken: CancelToken): Promise<number[]> => {
        const data: GetTopicOffsetsResult = await cancelToken.Fetch(`/api/topic/${topic}/offsets`)
        if (cancelToken.Aborted) {
            return []
        }
        if (data.error) {
            this.props.onError(data.error)
            return []
        }
        return data.offsets.map((r: TopicOffsets) => r.partition)
    }

    fetchOldest = async (timeout: number, cancelToken: CancelToken) => {
        let out: FetchData = null
        for (const topic of this.props.topics) {
            const partitions = await this.getSelectedPartitions(topic, cancelToken)
            for (const partition of partitions) {
                const offsets = await this.getPartitionOffsets(topic, partition, cancelToken)
                if (offsets === undefined) {
                    return
                }
                await this.setStateAsync({offset: offsets.low})
                out = await this.fetchMessagesForPartition(topic, timeout, partition, out, cancelToken)
            }
        }
    }

    fetchNewest = async (timeout: number, cancelToken: CancelToken) => {
        if (this.state.limit === "") {
            return
        }
        let out: FetchData = null
        for (const topic of this.props.topics) {
            const partitions = await this.getSelectedPartitions(topic, cancelToken)
            for (const partition of partitions) {
                const offsets = await this.getPartitionOffsets(topic, partition, cancelToken)
                if (offsets === undefined) {
                    return
                }
                let offset = offsets.high - this.state.limit
                if (offset < offsets.low) {
                    offset = offsets.low
                }
                await this.setStateAsync({offset})
                out = await this.fetchMessagesForPartition(topic, timeout, partition, out, cancelToken)
            }
        }
    }

    getPartitionOffsets = async (topic: string, partition: number, cancelToken: CancelToken) => {
        const data: GetTopicOffsetsResult = await cancelToken.Fetch(`/api/topic/${topic}/offsets`)
        if (cancelToken.Aborted) {
            return undefined
        }
        if (data.error) {
            this.props.onError(data.error)
            return undefined
        }
        return data.offsets.find((el: TopicOffsets) => el.partition === partition)
    }

    fetchByTime = async (timeout: number, cancelToken: CancelToken) => {
        let out: FetchData = null
        for (const topic of this.props.topics) {
            const partitions = await this.getSelectedPartitions(topic, cancelToken)
            for (const partition of partitions) {
                const fromOffset = await this.getOffsetForTime(topic, partition, this.state.fromTime, cancelToken)
                if (fromOffset === undefined) {
                    return
                }
                const toOffset = await this.getOffsetForTime(topic, partition, this.state.toTime, cancelToken)
                if (toOffset === undefined) {
                    return
                }
                const limit = toOffset - fromOffset
                await this.setStateAsync({offset: fromOffset, limit})
                out = await this.fetchMessagesForPartition(topic, timeout, partition, out, cancelToken)
            }
        }
    }

    fetchByOffsets = async (timeout: number, cancelToken: CancelToken) => {
        let out: FetchData = null
        for (const topic of this.props.topics) {
            const partitions = await this.getSelectedPartitions(topic, cancelToken)
            for (const partition of partitions) {
                out = await this.fetchMessagesForPartition(topic, timeout, partition, out, cancelToken)
            }
        }
    }

    fetchMessages = async (timeout: number, cancelToken: CancelToken) => {
        this.setState({ progress: {
            min: 0,
            max: 0,
            from: 0,
            to: 0,
            partition: "",
            topic: "",
        }})
        switch (this.state.searchBy) {
            case `offset`:
                await this.fetchByOffsets(timeout, cancelToken)
                break
            case `time`:
                await this.fetchByTime(timeout, cancelToken)
                break
            case `oldest`:
                await this.fetchOldest(timeout, cancelToken)
                break
            case `newest`:
                await this.fetchNewest(timeout, cancelToken)
                break
            default:
                this.props.onError(`Unsupported search by ${this.state.searchBy}`)
                break
        }
    }

    fetchMessagesForPartition = async (topic: string, timeout: number, partition: number, out: FetchData, cancelToken: CancelToken): Promise<FetchData> => {
        let cursor = this.state.offset
        if (cursor === undefined || cursor === "" || this.state.limit === "") {
            return null
        }
        const max = cursor + this.state.limit
        let limit = this.state.limit
        if (limit > 10000) {
            limit = 10000
        }
        if (cursor >= max) {
            this.props.onDataFetched(out)
        }
        const min = cursor
        while (cursor < max) {
            if (cancelToken.Aborted) {
                break
            }
            const to = Math.min(max, cursor + limit)
            this.setState({ progress: {
                min,
                max,
                from: cursor,
                to,
                partition: this.props.partition === AllPartitions ? `Partition ${partition}: ` : "",
                topic: this.props.topics.length > 1 ? `Topic ${topic}, ` : "",
            }})
            const data: GetTopicMessagesResult = await cancelToken.Fetch(
                `/api/messages/${topic}/${partition}?limit=${limit}&offset=${cursor}&search=${encodeURIComponent(this.state.search)}&search_style=${this.state.searchStyle}&timeout=${timeout}`,
            )
            if (cancelToken.Aborted) {
                break
            }
            cursor += limit
            if (!out) {
                out = data
            } else if (data.messages) {
                out.messages = [...out.messages, ...data.messages]
            }
            if (data.error) {
                out.error = data.error
            }
            if (data.hasTimeout) {
                out.hasTimeout = data.hasTimeout
            }
            this.setState({ progress: {
                min,
                max,
                from: to,
                to: to,
                partition: this.props.partition === AllPartitions ? `Partition ${partition}: ` : "",
                topic: this.props.topics.length > 1 ? `Topic ${topic}, ` : "",
            }})
            this.props.onDataFetched(out)
            if (out.error || out.hasTimeout) {
                break
            }
        }
        return out
    }

    updateUrl = () => {
        this.props.updateUrl()
        this.props.url.Set(
            {name: `search_by`, val: this.state.searchBy },
            {name: `offset`, val: this.state.searchBy === "offset" ? this.state.offset.toString() : ""},
            {name: `limit`, val: this.state.searchBy !== "time" ? this.state.limit.toString() : ""},
            {name: `from_time`, val: this.state.searchBy === "time" ? this.state.fromTime.toString() : ""},
            {name: `to_time`, val: this.state.searchBy === "time" ? this.state.toTime.toString() : ""},
        )
    }

    render() {
        return (
            <>
            <Toolbar>
                <div style={{ flex: 1 }}>
                {this.props.scope}
                <FormControl style={{ margin: 16, minWidth: 120 }}>
                    <InputLabel htmlFor="search-by-select">Search By</InputLabel>
                    <Select
                        value={this.state.searchBy}
                        onChange={(e: React.ChangeEvent<{ name?: string; value: unknown }>) => this.setState({ searchBy: e.target.value as SearchBy }, this.updateUrl)}
                        inputProps={{
                            name: 'searchBy',
                            id: 'search-by-select',
                        }}
                    >
                        <MenuItem key="search-by-offset" value="offset">Offset</MenuItem>
                        <MenuItem key="search-by-time" value="time">Time</MenuItem>
                        <MenuItem key="search-by-newest" value="newest">Newest</MenuItem>
                        <MenuItem key="search-by-oldest" value="oldest">Oldest</MenuItem>
                    </Select>
                </FormControl>
                {this.state.searchBy === "offset" &&
                <InputField
                    label="Offset"
                    value={this.state.offset}
                    onChange={(e: React.ChangeEvent<{ name?: string; value: unknown }>) => this.setState({ offset: e.target.value === "" ? "" : parseInt(e.target.value as string) }, this.updateUrl)}
                    onEnter={async () => { await this.onFetchMessagesClicked() }}
                />}
                {this.state.searchBy !== "time" &&
                <InputField
                    label="Limit"
                    value={this.state.limit}
                    onChange={(e: React.ChangeEvent<{ name?: string; value: unknown }>) => this.setState({ limit: e.target.value === "" ? "" : parseInt(e.target.value as string) }, this.updateUrl)}
                    onEnter={async () => { await this.onFetchMessagesClicked() }}
                />}
                {this.state.searchBy === "time" &&
                <>
                <DateTimeField
                    label="From"
                    value={this.state.fromTime}
                    onChange={(e: React.ChangeEvent<{ name?: string; value: unknown }>) => this.setState({ fromTime: e.target.value as string }, this.updateUrl)}
                    onEnter={async () => { await this.onFetchMessagesClicked() }}
                ></DateTimeField>
                <DateTimeField
                    label="To"
                    value={this.state.toTime}
                    onChange={(e: React.ChangeEvent<{ name?: string; value: unknown }>) => this.setState({ toTime: e.target.value as string }, this.updateUrl)}
                    onEnter={async () => { await this.onFetchMessagesClicked() }}
                ></DateTimeField>
                </>}
                </div>
                <GoButton
                    onRun={this.onFetchMessagesClicked}
                    onCancel={() => this.loader.Abort() }
                    isRunning={this.props.loadingMessages}>
                </GoButton>
            </Toolbar>
            <ErrorMsg error={this.props.error} prefix={this.props.errorPrefix}></ErrorMsg>
            {this.renderProgress()}
            </>
        )
    }

    normalizeProgress(value: number) {
        return (value - this.state.progress.min) * 100 / (this.state.progress.max - this.state.progress.min)
    }

    renderProgress() {
        return (
            <Fade in={this.props.loadingMessages && this.state.progress.max !== 0} style={{
                transitionDelay: this.props.loadingMessages && this.state.progress.max !== 0 ? '1500ms' : '0ms',
              }}
              unmountOnExit>
                  <Box alignItems="center" style={{float: "right", paddingRight: 15, width: "40%"}}>
                      <Box minWidth={35} style={{padding: 10}}>
                          <Typography variant="body2" color="textSecondary" align="center">{`${this.state.progress.topic}${this.state.progress.partition}Loading offset ${this.state.progress.from} (${Math.round(
                          this.normalizeProgress(this.state.progress.from),
                          )}%)`}</Typography>
                      </Box>
                      <Box width="100%" mr={1}>
                          <LinearProgress variant="buffer" value={this.normalizeProgress(this.state.progress.from)} valueBuffer={this.normalizeProgress(this.state.progress.to)}/>
                      </Box>
                  </Box>
              </Fade>
        )
    }
}