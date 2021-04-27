import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import MenuItem from '@material-ui/core/MenuItem';
import { Fetcher, SearchBy, AllPartitions, FetchData } from './fetcher';
import { Url } from '../../common/url';
import { GetTopicOffsetsResult, TopicOffsets } from "../../../shared/api";

interface Props {
    topic: string;
    partition?: string;
    offset?: number;
    limit?: number;
    fromTime?: string;
    toTime?: string;
    searchBy: SearchBy;
    url: Url;
    onDataFetched: (data: FetchData) => void;
    onDataFetchStarted: (partition: string) => void;
}

type State = {
    partition: string;
    offset: number;
    loadingMessages: boolean;
    loadingPartitions: boolean;
    partitions: PartitionSelector[];
    error?: string;
}

type PartitionSelector = {
    label: string;
    value: string;
    isEmpty: boolean;
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
        const data: GetTopicOffsetsResult = await response.json()
        if (data.error) {
            this.setState({loadingPartitions: false, error: data.error})
            return
        }
        const results: PartitionSelector[] = data.offsets.map((r: TopicOffsets) => {
            const isEmpty = r.high.toString() === "0"
            const label = isEmpty ?
                `Partition: ${r.partition} (Empty)` :
                `Partition: ${r.partition} (Low- ${r.low}, High- ${r.high}, Current- ${r.offset})`;
            return { label: label, value: r.partition.toString(), isEmpty }
        })
        const newState: Pick<State, keyof State> = { loadingPartitions: false, partitions: [{label: `All Partitions`, value: AllPartitions, isEmpty: true}, ...results], offset: this.state.offset, partition: this.state.partition, loadingMessages: this.state.loadingMessages }
        if (this.props.partition === undefined) {
            const nonEmpty = results.find(row => !row.isEmpty)
            if (nonEmpty) {
                newState.partition = nonEmpty.value
            }
        }
        const partitionIndex = newState.partition || this.props.partition
        const offset = await this.getInitialOffset(partitionIndex, data)
        if (offset !== undefined) {
            newState.offset = offset
        }
        this.setState(newState)
    }

    getInitialOffset = async (partitionIndex: string | undefined, data: GetTopicOffsetsResult): Promise<number | undefined> => {
        if (this.props.offset !== undefined) {
            return this.props.offset
        }
        if (partitionIndex === undefined || partitionIndex === AllPartitions) {
            return undefined
        }
        const partition = data.offsets[parseInt(partitionIndex)]
        const high = parseInt(partition.high)
        const low = parseInt(partition.low)
        let offset = high - (this.props.limit ?? 5)
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
                            onChange={(e: React.ChangeEvent<{ name?: string; value: unknown }>) => this.setState({ partition: e.target.value as string }, () => { this.updateUrl(); this.props.url.Refresh(); })}
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
                searchBy={this.props.searchBy}
                onDataFetched={this.props.onDataFetched}
                onDataFetchStarted={() => { this.setState({loadingMessages: true}); this.props.onDataFetchStarted(this.state.partition)} }
                onDataFetchCompleted={() => this.setState({loadingMessages: false})}
                loadingMessages={this.state.loadingMessages}
                error={this.state.error ?? ""}
                errorPrefix={"Error while loading messages: "}
            >
            </Fetcher>)}
            </>
        )
    }
}