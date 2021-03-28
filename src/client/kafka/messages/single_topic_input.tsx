import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import MenuItem from '@material-ui/core/MenuItem';
import { Fetcher, SearchBy, AllPartitions } from './fetcher';
import { Url } from '../../common/url';

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

type State = {
    partition: string;
    offset: number;
    loadingMessages: boolean;
    loadingPartitions: boolean;
    partitions: any[];
    error: any;
}

export class SingleTopicInput extends React.Component<Props, State> {
    state: State = {
        offset: 0,
        partitions: [],
        loadingMessages: false,
        loadingPartitions: true,
        partition: this.props.partition || "0",
        error: "",
    }

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
        this.setState(newState)
    }

    getInitialOffset = async (partitionIndex: string | undefined, data: any): Promise<number | undefined> => {
        if (this.props.offset !== undefined) {
            return parseInt(this.props.offset)
        }
        if (partitionIndex === undefined || partitionIndex === AllPartitions) {
            return undefined
        }
        const partition = data.offsets[parseInt(partitionIndex)]
        const high = parseInt(partition.high)
        const low = parseInt(partition.low)
        let offset = high - this.props.limit
        if (offset < low) {
            offset = low
        }
        return offset
    }

    updateUrl = () => {
        this.props.url.BaseUrl = `/topic/messages/${this.props.topic}/${this.state.partition}`
    }

    render() {
        if (this.state.loadingPartitions) {
            return (<><CircularProgress /><div>Loading...</div></>)
        }
        const partitions = this.state.partitions.map(p => (<MenuItem key={p.label} value={p.value}>{p.label}</MenuItem>))
        return (
            <>
            {!this.state.loadingPartitions && ( <Fetcher
                url={this.props.url}
                updateUrl={this.updateUrl}
                onError={(error: string) => this.setState({error})}
                scope={(
                    <FormControl style={{ margin: 16, minWidth: 120 }}>
                        <InputLabel htmlFor="partition-select">Partition</InputLabel>
                        <Select
                            value={this.state.partition}
                            onChange={(e: any) => this.setState({ partition: e.target.value }, () => { this.updateUrl(); this.props.url.Refresh(); })}
                            inputProps={{
                                name: 'partition',
                                id: 'partition-select',
                            }}
                        >
                            {partitions}
                        </Select>
                    </FormControl>
                )}
                topics={[this.props.topic]}
                partition={this.state.partition}
                offset={this.state.offset}
                limit={this.props.limit}
                fromTime={this.props.fromTime}
                toTime={this.props.toTime}
                search={this.props.search}
                searchBy={this.props.searchBy}
                onDataFetched={this.props.onDataFetched}
                onDataFetchStarted={() => { this.setState({loadingMessages: true}); this.props.onDataFetchStarted} }
                onDataFetchCompleted={() => this.setState({loadingMessages: false})}
                loadingMessages={this.state.loadingMessages}
                error={this.state.error}
                errorPrefix={"Error while loading messages: "}
            >
            </Fetcher>)}
            </>
        )
    }
}