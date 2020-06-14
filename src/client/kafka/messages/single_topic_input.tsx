import React from "react";
import TextField from '@material-ui/core/TextField';
import CircularProgress from '@material-ui/core/CircularProgress';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import Toolbar from '@material-ui/core/Toolbar';
import MenuItem from '@material-ui/core/MenuItem';
import { GoButton } from './go_button';

interface Props {
    topic: string;
    partition?: string;
    search: string;
    onDataFetched: (data: any) => void;
}

type State = {
    partition: string;
    loadingMessages: boolean;
    loadingPartitions: boolean;
    offset: number;
    limit: number;
    partitions: any[];
}

interface InputProps{
    label: string;
    value: number;
    onChange?: any;
}

const InputField: React.SFC<InputProps> = (props) => {
    return (
        <TextField
            label={props.label}
            type="number"
            value={props.value}
            onChange={props.onChange}
            margin="normal"
            inputProps={{ min: "0", step: "1" }}
            style={{ marginRight: 10, maxWidth: 50 }}
        />
    )
}


export class SingleTopicInput extends React.Component<Props, State> {
    state: State = { partitions: [], offset: 0, limit: 10, loadingMessages: false, loadingPartitions: true, partition: this.props.partition || "0" }

    async componentDidMount() {
        await this.fetchPartitions()
    }

    async fetchPartitions() {
        const response = await fetch(`/api/topic/${this.props.topic}`)
        const data: any = await response.json()
        const results = data.offsets.map((r: any) => {
            const isEmpty = r.high.toString() === "0"
            const label = isEmpty ?
                `Partition: ${r.partition} (Empty)` :
                `Partition: ${r.partition} (Low- ${r.low}, High- ${r.high}, Current- ${r.offset})`;
            return { label: label, value: r.partition.toString(), isEmpty }
        })
        const newState: any = { loadingPartitions: false, partitions: results }
        if (this.props.partition === undefined) {
            const nonEmpty = results.find((row: any) => !row.isEmpty)
            if (nonEmpty) {
                newState.partition = nonEmpty.value
            }
        }
        this.setState(newState)
    }

    async fetchMessages() {
        this.setState({ loadingMessages: true })
        const topic = this.props.topic
        const response = await fetch(`/api/messages/${topic}/${this.state.partition}?limit=${this.state.limit}&offset=${this.state.offset}&search=${this.props.search}`)
        const data = await response.json()
        this.props.onDataFetched(data)
        this.setState({loadingMessages: false})
    }

    render() {
        if (this.state.loadingPartitions) {
            return (<><CircularProgress /><div>Loading...</div></>)
        }
        const partitions = this.state.partitions.map(p => (<MenuItem key={p.label} value={p.value}>{p.label}</MenuItem>))
        return (
            <Toolbar>
                <div style={{ flex: 1 }}>
                    <FormControl style={{ margin: 16, minWidth: 120 }}>
                        <InputLabel htmlFor="partition-select">Partition</InputLabel>
                        <Select
                            value={this.state.partition}
                            onChange={(e: any) => this.setState({ partition: e.target.value })}
                            inputProps={{
                                name: 'partition',
                                id: 'partition-select',
                            }}
                        >
                            {partitions}
                        </Select>
                    </FormControl>
                    <InputField
                        label="Offset"
                        value={this.state.offset}
                        onChange={(e: any) => this.setState({ offset: parseInt(e.target.value) })}
                    />
                    <InputField
                        label="Limit"
                        value={this.state.limit}
                        onChange={(e: any) => this.setState({ limit: parseInt(e.target.value) })}
                    />
                    </div>
                    <GoButton
                        onClick={async () => { await this.fetchMessages() }}
                        isRunning={this.state.loadingMessages}>
                    </GoButton>
            </Toolbar>
        )
    }
}