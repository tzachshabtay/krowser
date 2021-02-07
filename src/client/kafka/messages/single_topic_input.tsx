import React from "react";
import TextField from '@material-ui/core/TextField';
import CircularProgress from '@material-ui/core/CircularProgress';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import Toolbar from '@material-ui/core/Toolbar';
import MenuItem from '@material-ui/core/MenuItem';
import { GoButton } from './go_button';
import { ErrorMsg} from '../../common/error_msg';
import { Url } from '../../common/url';

interface Props {
    topic: string;
    partition?: string;
    offset?: any;
    limit?: any;
    fromTime?: any;
    toTime?: any;
    search: string;
    url: Url;
    onDataFetched: (data: any) => void;
    onDataFetchStarted: () => void;
}

type State = {
    searchBy: "offset" | "time";
    partition: string;
    loadingMessages: boolean;
    loadingPartitions: boolean;
    offset: number;
    limit: number;
    fromTime: string;
    toTime: string;
    partitions: any[];
    error: any;
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
        searchBy: "offset"
    }

    async componentDidMount() {
        await this.fetchPartitions()
    }

    async fetchPartitions() {
        const response = await fetch(`/api/topic/${this.props.topic}`)
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
        const newState: any = { loadingPartitions: false, partitions: results }
        if (this.props.limit !== undefined) {
            newState.limit = parseInt(this.props.limit)
            newState.searchBy = `offset`
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
            newState.searchBy = `time`
        }
        const offset = await this.getInitialOffset(partitionIndex, data)
        if (this.props.toTime !== undefined) {
            newState.toTime = this.props.toTime
            newState.searchBy = `time`
            if (offset) {
                const partition = data.offsets[parseInt(partitionIndex)]
                let toOffset = await this.getOffsetForTime(partition.partition, this.props.toTime)
                if (toOffset !== undefined) {
                    newState.limit = toOffset - offset
                }
            }
        }
        if (offset === undefined) {
            this.setState(newState, this.updateUrl)
        } else {
            newState.offset = offset
            this.setState(newState, this.fetchMessagesOnStart)
        }
    }

    getInitialOffset = async (partitionIndex: string | undefined, data: any): Promise<number | undefined> => {
        if (this.props.offset !== undefined) {
            return parseInt(this.props.offset)
        }
        if (partitionIndex === undefined) {
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
        if (this.state.searchBy === `offset`) {
            await this.fetchMessagesLong()
            return
        }
        const fromOffset = await this.getOffsetForTime(parseInt(this.state.partition), this.state.fromTime)
        if (fromOffset === undefined) {
            return
        }
        const toOffset = await this.getOffsetForTime(parseInt(this.state.partition), this.state.toTime)
        if (toOffset === undefined) {
            return
        }
        const limit = toOffset - fromOffset
        this.setState({offset: fromOffset, limit}, this.fetchMessagesLong)
    }

    fetchMessagesLong = async () => {
        await this.fetchMessages(20000)
    }

    fetchMessages = async (timeout: number) => {
        this.setState({ loadingMessages: true })
        this.props.onDataFetchStarted()
        const topic = this.props.topic
        let cursor = this.state.offset
        const end = cursor + this.state.limit
        let out: any = null
        let limit = this.state.limit
        if (limit > 1000) {
            limit = 1000
        }
        if (cursor >= end) {
            this.props.onDataFetched({messages: []})
        }
        while (cursor < end) {
            const response = await fetch(`/api/messages/${topic}/${this.state.partition}?limit=${limit}&offset=${cursor}&search=${this.props.search}&timeout=${timeout}`)
            cursor += limit
            const data = await response.json()
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
            this.props.onDataFetched(out)
            if (out.error || out.hasTimeout) {
                break
            }
        }
        this.setState({loadingMessages: false})
    }

    updateUrl = () => {
        this.props.url.BaseUrl = `/topic/messages/${this.props.topic}/${this.state.partition}`
        this.props.url.Set(
            {name: `offset`, val: this.state.searchBy === "offset" ? this.state.offset.toString() : ""},
            {name: `limit`, val: this.state.searchBy === "offset" ? this.state.limit.toString() : ""},
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
                        </Select>
                    </FormControl>
                    {this.state.searchBy === "offset" &&
                    <>
                    <InputField
                        label="Offset"
                        value={this.state.offset}
                        onChange={(e: any) => this.setState({ offset: parseInt(e.target.value) }, this.updateUrl)}
                        onEnter={async () => { await this.onFetchMessagesClicked() }}
                    />
                    <InputField
                        label="Limit"
                        value={this.state.limit}
                        onChange={(e: any) => this.setState({ limit: parseInt(e.target.value) }, this.updateUrl)}
                        onEnter={async () => { await this.onFetchMessagesClicked() }}
                    />
                    </>}
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
                        onClick={async () => { await this.onFetchMessagesClicked() }}
                        isRunning={this.state.loadingMessages}>
                    </GoButton>
            </Toolbar>
            <ErrorMsg error={this.state.error} prefix="Failed to fetch partitions. Error: "></ErrorMsg>
            </>
        )
    }
}