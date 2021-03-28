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
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';

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
    offset?: any;
    limit?: any;
    fromTime?: any;
    toTime?: any;
    search: string;
    searchBy: SearchBy;
    onDataFetched: (data: any) => void;
    onDataFetchStarted: (partition: string) => void;
    onDataFetchCompleted: () => void;
    loadingMessages: boolean;
    error: string;
    errorPrefix: string;
}

type State = {
    searchBy: SearchBy;
    offset: number;
    limit: number;
    fromTime: string;
    toTime: string;
    progress: Progress;
    isCanceled: boolean;
    abortController: AbortController | null;
}

interface InputProps{
    label: string;
    value: number;
    onChange?: any;
    onEnter: () => {};
}

const enterKey = 13;

const InputField: React.FunctionComponent<InputProps> = (props) => {
    return (
        <TextField
            label={props.label}
            type="number"
            value={props.value}
            onChange={props.onChange}
            onKeyDown={(e) => {if (e.keyCode === enterKey) props.onEnter()}}
            margin="normal"
            inputProps={{ min: "0", step: "1" }}
            style={{ marginRight: 10, maxWidth: 100 }}
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
            onKeyDown={(e) => {if (e.keyCode === enterKey) props.onEnter()}}
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
        isCanceled: false,
        abortController: null,
    }

    setStateAsync = (updater: any) => new Promise((resolve: any)=> this.setState(updater, resolve))

    async componentDidMount() {
        this.updateUrl()
        await this.fetchMessages(10000)
    }

    getOffsetForTime = async (topic: string, partition: number, time: string): Promise<number | undefined> => {
        const millis = new Date(time).getTime();
        const response = await fetch(`/api/offsets/${topic}/${millis}`)
        const data: any = await response.json()
        if (data.error) {
            this.props.onError(data.error)
            return undefined
        }
        const result = parseInt(data.find((item: { partition: number; }) => item.partition === partition)?.offset ?? "0")
        console.log(result)
        return result
    }

    onFetchMessagesClicked = async () => {
        await this.fetchMessages(20000)
    }

    getSelectedPartitions = async(topic: string): Promise<string[]> => {
        if (this.props.partition !== AllPartitions) {
            return [this.props.partition]
        }
        return await this.getAllPartitionsForTopic(topic)
    }

    getAllPartitionsForTopic = async(topic: string): Promise<string[]> => {
        const response = await fetch(`/api/topic/${topic}/offsets`)
        const data: any = await response.json()
        if (data.error) {
            this.props.onError(data.error)
            return []
        }
        return data.offsets.map((r: any) => r.partition)
    }

    fetchOldest = async (timeout: number) => {
        let out: any = null
        for (const topic of this.props.topics) {
            const partitions = await this.getSelectedPartitions(topic)
            for (const partition of partitions) {
                const offsets = await this.getPartitionOffsets(topic, partition)
                if (offsets === undefined) {
                    return
                }
                await this.setStateAsync({offset: parseInt(offsets.low)})
                out = await this.fetchMessagesForPartition(topic, timeout, partition, out)
            }
        }
    }

    fetchNewest = async (timeout: number) => {
        let out: any = null
        for (const topic of this.props.topics) {
            const partitions = await this.getSelectedPartitions(topic)
            for (const partition of partitions) {
                const offsets = await this.getPartitionOffsets(topic, partition)
                if (offsets === undefined) {
                    return
                }
                await this.setStateAsync({offset: parseInt(offsets.high) - this.state.limit})
                out = await this.fetchMessagesForPartition(topic, timeout, partition, out)
            }
        }
    }

    getPartitionOffsets = async (topic: string, partition: string) => {
        const response = await fetch(`/api/topic/${topic}/offsets`)
        const data: any = await response.json()
        if (data.error) {
            this.props.onError(data.error)
            return undefined
        }
        return data.offsets.find((el: any) => el.partition.toString() === partition.toString())
    }

    fetchByTime = async (timeout: number) => {
        let out: any = null
        for (const topic of this.props.topics) {
            const partitions = await this.getSelectedPartitions(topic)
            for (const partition of partitions) {
                const fromOffset = await this.getOffsetForTime(topic, parseInt(partition), this.state.fromTime)
                if (fromOffset === undefined) {
                    return
                }
                const toOffset = await this.getOffsetForTime(topic, parseInt(partition), this.state.toTime)
                if (toOffset === undefined) {
                    return
                }
                const limit = toOffset - fromOffset
                await this.setStateAsync({offset: fromOffset, limit})
                out = await this.fetchMessagesForPartition(topic, timeout, partition, out)
            }
        }
    }

    fetchByOffsets = async (timeout: number) => {
        let out: any = null
        for (const topic of this.props.topics) {
            const partitions = await this.getSelectedPartitions(topic)
            for (const partition of partitions) {
                out = await this.fetchMessagesForPartition(topic, timeout, partition, out)
            }
        }
    }

    fetchMessages = async (timeout: number) => {
        this.setState({ progress: {
            min: 0,
            max: 0,
            from: 0,
            to: 0,
            partition: "",
            topic: "",
        }})
        try {
            this.props.onDataFetchStarted(this.props.partition)
            switch (this.state.searchBy) {
                case `offset`:
                    await this.fetchByOffsets(timeout)
                    break
                case `time`:
                    await this.fetchByTime(timeout)
                    break
                case `oldest`:
                    await this.fetchOldest(timeout)
                    break
                case `newest`:
                    await this.fetchNewest(timeout)
                    break
                default:
                    this.props.onError(`Unsupported search by ${this.state.searchBy}`)
                    break
            }
        }
        finally {
            this.props.onDataFetchCompleted()
        }
    }

    fetchMessagesForPartition = async (topic: string, timeout: number, partition: string, out: any): Promise<any> => {
        let cursor = this.state.offset
        if (cursor === undefined) {
            return null
        }
        const max = cursor + this.state.limit
        let limit = this.state.limit
        if (limit > 1000) {
            limit = 1000
        }
        if (cursor >= max) {
            this.props.onDataFetched({messages: out ?? []})
        }
        const min = cursor
        while (cursor < max) {
            if (this.state.isCanceled) {
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
            const response = await fetch(
                `/api/messages/${topic}/${partition}?limit=${limit}&offset=${cursor}&search=${this.props.search}&timeout=${timeout}`,
                {signal: this.state.abortController?.signal}
            )
            if (this.state.isCanceled) {
                break
            }
            cursor += limit
            const data = await response.json()
            if (this.state.isCanceled) {
                break
            }
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
                        onChange={(e: any) => this.setState({ searchBy: e.target.value }, this.updateUrl)}
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
                    onChange={(e: any) => this.setState({ offset: parseInt(e.target.value) }, this.updateUrl)}
                    onEnter={async () => { await this.onFetchMessagesClicked() }}
                />}
                {this.state.searchBy !== "time" &&
                <InputField
                    label="Limit"
                    value={this.state.limit}
                    onChange={(e: any) => this.setState({ limit: parseInt(e.target.value) }, this.updateUrl)}
                    onEnter={async () => { await this.onFetchMessagesClicked() }}
                />}
                {this.state.searchBy === "time" &&
                <>
                <DateTimeField
                    label="From"
                    value={this.state.fromTime}
                    onChange={(e: any) => this.setState({ fromTime: e.target.value }, this.updateUrl)}
                    onEnter={async () => { await this.onFetchMessagesClicked() }}
                ></DateTimeField>
                <DateTimeField
                    label="To"
                    value={this.state.toTime}
                    onChange={(e: any) => this.setState({ toTime: e.target.value }, this.updateUrl)}
                    onEnter={async () => { await this.onFetchMessagesClicked() }}
                ></DateTimeField>
                </>}
                </div>
                <GoButton
                    onRun={() => {
                        return new Promise((resolve, reject) => {
                            this.setState({isCanceled: false, abortController: new AbortController()},
                            async () => {
                                try {
                                    await this.onFetchMessagesClicked()
                                    resolve()
                                } catch (error) {
                                    if (error.name === 'AbortError') {
                                        this.props.onDataFetchCompleted()
                                        resolve()
                                    } else {
                                        reject(error)
                                    }
                                }
                            })
                        })
                    }}
                    onCancel={() => this.setState({isCanceled: true}, () => this.state.abortController?.abort())}
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