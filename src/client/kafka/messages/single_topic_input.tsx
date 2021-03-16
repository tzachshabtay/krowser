import React from "react";
import TextField from '@material-ui/core/TextField';
import CircularProgress from '@material-ui/core/CircularProgress';
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

interface Props {
    topic: string;
    partition?: string;
    offset?: any;
    limit?: any;
    fromTime?: any;
    toTime?: any;
    search: string;
    searchBy: SearchBy;
    url: Url;
    onDataFetched: (data: any) => void;
    onDataFetchStarted: (partition: string) => void;
}

type progress = {
    min: number;
    max: number;
    from: number;
    to: number;
    partition: string;
}

type State = {
    searchBy: SearchBy;
    partition: string;
    loadingMessages: boolean;
    loadingPartitions: boolean;
    offset: number;
    limit: number;
    fromTime: string;
    toTime: string;
    partitions: any[];
    error: any;
    progress: progress;
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

export class SingleTopicInput extends React.Component<Props, State> {
    state: State = {
        partitions: [],
        offset: 0,
        limit: 5,
        fromTime: "",
        toTime: "",
        loadingMessages: false,
        loadingPartitions: true,
        partition: this.props.partition || "0",
        error: "",
        searchBy: this.props.searchBy,
        progress: {
            min: 0,
            max: 0,
            from: 0,
            to: 0,
            partition: "",
        },
        isCanceled: false,
        abortController: null,
    }

    setStateAsync = (updater: any) => new Promise((resolve: any)=> this.setState(updater, resolve))

    async componentDidMount() {
        await this.fetchPartitions()
    }

    async fetchPartitions() {
        const response = await fetch(`/api/topic/${this.props.topic}/offsets`)
        const data: any = await response.json()
        if (data.error) {
            this.setState({loadingPartitions: false, error: data.error})
            return
        }
        const results = data.offsets.map((r: any) => {
            const isEmpty = r.high.toString() === "0"
            const label = isEmpty ?
                `Partition: ${r.partition} (Empty)` :
                `Partition: ${r.partition} (Low- ${r.low}, High- ${r.high}, Current- ${r.offset})`;
            return { label: label, value: r.partition.toString(), isEmpty }
        })
        const newState: any = { loadingPartitions: false, partitions: [{label: `All Partitions`, value: AllPartitions}, ...results] }
        if (this.props.limit !== undefined) {
            newState.limit = parseInt(this.props.limit)
        }
        if (this.props.partition === undefined) {
            const nonEmpty = results.find((row: any) => !row.isEmpty)
            if (nonEmpty) {
                newState.partition = nonEmpty.value
            }
        }
        const partitionIndex = newState.partition || this.props.partition
        if (this.props.fromTime !== undefined) {
            newState.fromTime = this.props.fromTime
        }
        const offset = await this.getInitialOffset(partitionIndex, data)
        newState.offset = offset
        newState.toTime = this.props.toTime ?? ""
        this.setState(newState, this.fetchMessagesOnStart)
    }

    getInitialOffset = async (partitionIndex: string | undefined, data: any): Promise<number | undefined> => {
        if (this.props.offset !== undefined) {
            return parseInt(this.props.offset)
        }
        if (partitionIndex === undefined || partitionIndex === AllPartitions) {
            return undefined
        }
        const partition = data.offsets[parseInt(partitionIndex)]
        let offset = partition.high - this.state.limit
        if (this.props.fromTime !== undefined) {
            const offsetOrUndefined = await this.getOffsetForTime(partition.partition, this.props.fromTime)
            if (offsetOrUndefined === undefined) {
                return undefined
            }
            offset = offsetOrUndefined
        }
        if (offset < partition.low) {
            offset = partition.low
        }
        return offset
    }

    getOffsetForTime = async (partition: number, time: string): Promise<number | undefined> => {
        const millis = new Date(time).getTime();
        const response = await fetch(`/api/offsets/${this.props.topic}/${millis}`)
        const data: any = await response.json()
        if (data.error) {
            this.setState({error: data.error})
            return undefined
        }
        const result = parseInt(data.find((item: { partition: number; }) => item.partition === partition)?.offset ?? "0")
        console.log(result)
        return result
    }

    fetchMessagesOnStart = async () => {
        this.updateUrl()
        await this.fetchMessages(10000)
    }

    onFetchMessagesClicked = async () => {
        await this.fetchMessages(20000)
    }

    getSelectedPartitions = (): string[] => {
        if (this.state.partition !== AllPartitions) {
            return [this.state.partition]
        }
        return this.state.partitions.slice(1).map(r => r.value)
    }

    fetchOldest = async (timeout: number) => {
        const partitions = this.getSelectedPartitions()
        let out: any = null
        for (const partition of partitions) {
            const offsets = await this.getPartitionOffsets(partition)
            if (offsets === undefined) {
                return
            }
            await this.setStateAsync({offset: parseInt(offsets.low)})
            out = await this.fetchMessagesForPartition(timeout, partition, out)
        }
    }

    fetchNewest = async (timeout: number) => {
        const partitions = this.getSelectedPartitions()
        let out: any = null
        for (const partition of partitions) {
            const offsets = await this.getPartitionOffsets(partition)
            if (offsets === undefined) {
                return
            }
            await this.setStateAsync({offset: parseInt(offsets.high) - this.state.limit})
            out = await this.fetchMessagesForPartition(timeout, partition, out)
        }
    }

    getPartitionOffsets = async (partition: string) => {
        const response = await fetch(`/api/topic/${this.props.topic}/offsets`)
        const data: any = await response.json()
        if (data.error) {
            this.setState({loadingMessages: false, error: data.error})
            return undefined
        }
        return data.offsets.find((el: any) => el.partition.toString() === partition.toString())
    }

    fetchByTime = async (timeout: number) => {
        const partitions = this.getSelectedPartitions()
        let out: any = null
        for (const partition of partitions) {
            const fromOffset = await this.getOffsetForTime(parseInt(partition), this.state.fromTime)
            if (fromOffset === undefined) {
                return
            }
            const toOffset = await this.getOffsetForTime(parseInt(partition), this.state.toTime)
            if (toOffset === undefined) {
                return
            }
            const limit = toOffset - fromOffset
            await this.setStateAsync({offset: fromOffset, limit})
            out = await this.fetchMessagesForPartition(timeout, partition, out)
        }
    }

    fetchByOffsets = async (timeout: number) => {
        const partitions = this.getSelectedPartitions()
        let out: any = null
        for (const partition of partitions) {
            out = await this.fetchMessagesForPartition(timeout, partition, out)
        }
    }

    fetchMessages = async (timeout: number) => {
        this.setState({ loadingMessages: true, progress: {
            min: 0,
            max: 0,
            from: 0,
            to: 0,
            partition: "",
        }})
        try {
            this.props.onDataFetchStarted(this.state.partition)
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
                    this.setState({error: `Unsupported search by ${this.state.searchBy}`})
                    break
            }
        }
        finally {
            this.setState({loadingMessages: false})
        }
    }

    fetchMessagesForPartition = async (timeout: number, partition: string, out: any): Promise<any> => {
        const topic = this.props.topic
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
                partition: this.state.partition === AllPartitions ? `Partition ${partition}: ` : "",
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
                partition: this.state.partition === AllPartitions ? `Partition ${partition}: ` : "",
            }})
            this.props.onDataFetched(out)
            if (out.error || out.hasTimeout) {
                break
            }
        }
        return out
    }

    updateUrl = () => {
        this.props.url.BaseUrl = `/topic/messages/${this.props.topic}/${this.state.partition}`
        this.props.url.Set(
            {name: `search_by`, val: this.state.searchBy },
            {name: `offset`, val: this.state.searchBy === "offset" ? this.state.offset.toString() : ""},
            {name: `limit`, val: this.state.searchBy !== "time" ? this.state.limit.toString() : ""},
            {name: `from_time`, val: this.state.searchBy === "time" ? this.state.fromTime.toString() : ""},
            {name: `to_time`, val: this.state.searchBy === "time" ? this.state.toTime.toString() : ""},
        )
    }

    render() {
        if (this.state.loadingPartitions) {
            return (<><CircularProgress /><div>Loading...</div></>)
        }
        const partitions = this.state.partitions.map(p => (<MenuItem key={p.label} value={p.value}>{p.label}</MenuItem>))
        return (
            <>
            <Toolbar>
                <div style={{ flex: 1 }}>
                    <FormControl style={{ margin: 16, minWidth: 120 }}>
                        <InputLabel htmlFor="partition-select">Partition</InputLabel>
                        <Select
                            value={this.state.partition}
                            onChange={(e: any) => this.setState({ partition: e.target.value }, this.updateUrl)}
                            inputProps={{
                                name: 'partition',
                                id: 'partition-select',
                            }}
                        >
                            {partitions}
                        </Select>
                    </FormControl>
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
                                            this.setState({loadingMessages: false})
                                            resolve()
                                        } else {
                                            reject(error)
                                        }
                                    }
                                })
                            })
                        }}
                        onCancel={() => this.setState({isCanceled: true}, () => this.state.abortController?.abort())}
                        isRunning={this.state.loadingMessages}>
                    </GoButton>
            </Toolbar>
            <ErrorMsg error={this.state.error} prefix="Failed to fetch partitions. Error: "></ErrorMsg>
            {this.renderProgress()}
            </>
        )
    }

    normalizeProgress(value: number) {
        return (value - this.state.progress.min) * 100 / (this.state.progress.max - this.state.progress.min)
    }

    renderProgress() {
        return (
            <Fade in={this.state.loadingMessages && this.state.progress.max !== 0} style={{
                transitionDelay: this.state.loadingMessages && this.state.progress.max !== 0 ? '1500ms' : '0ms',
              }}
              unmountOnExit>
                  <Box alignItems="center" style={{float: "right", paddingRight: 15, width: "40%"}}>
                      <Box minWidth={35} style={{padding: 10}}>
                          <Typography variant="body2" color="textSecondary" align="center">{`${this.state.progress.partition}Loading offset ${this.state.progress.from} (${Math.round(
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