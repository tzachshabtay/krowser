import React from "react";
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, GridApi, ColumnApi } from 'ag-grid-community';
import { RouteComponentProps } from "react-router-dom";
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';
import { KafkaToolbar} from '../../common/toolbar';
import { SingleTopicInput} from './single_topic_input';
import { MultiTopicsInput} from './multi_topics_input';
import Typography from '@material-ui/core/Typography';

interface Props extends RouteComponentProps<{ topic?: string, partition?: string }> {
}

type State = {
    search: string;
    rows: any[];
    error: string;
    customCols: {cols: {}};
}

export class Messages extends React.Component<Props, State> {
    state: State = { search: "", rows: [], customCols: {cols: {}}, error: "" }
    api: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    getRow = (data: any, customCols: {cols: {}}): any => {
        let row = {
            rowTimestamp: data.message.timestamp,
            rowOffset: parseInt(data.message.offset),
            rowText: data.value,
            rowType: data.schemaType ? data.schemaType.name : "",
            rowKey: data.key,
            rowTopic: data.topic,
            rowPartition: data.partition,
        }
        try {
            const cols = JSON.parse(data.value)
            row = {...row, ...cols}
            customCols.cols = {...customCols.cols, ...cols}
        }
        catch (error) {
            console.warn(`row is not json encoded, error: ${error}`)
        }
        return row
    }

    getColumnDefs = () => {
        const cols: any[] = [
            { headerName: "Timestamp", field: "rowTimestamp", valueFormatter: this.timeFormatter },
            { headerName: "Offset", field: "rowOffset", filter: "agNumberColumnFilter" },
            { headerName: "Type", field: "rowType" }
        ]
        if (this.props.match.params.topic === undefined) {
            cols.push({headerName: "Topic", field: "rowTopic"})
            cols.push({headerName: "Partition", field: "rowPartition"})
        }
        this.addCustomColumns(cols, this.state.customCols.cols, ``)
        cols.push({headerName: "Key", field: "rowKey"})
        cols.push({headerName: "Text", field: "rowText"})
        return cols
    }

    addCustomColumns = (cols: any[], fields: any, prefix: string) => {
        for (const prop in fields) {
            const val: any = fields[prop]
            if (typeof val === 'object') {
                this.addCustomColumns(cols, val, `${prefix}${prop}.`)
            } else {
                const name = `${prefix}${prop}`
                cols.push({headerName: name, field: name})
            }
        }
    }

    timeFormatter(params: any) {
        const date = new Date(parseFloat(params.value));
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const day = date.getDate().toString().padStart(2, "0")
        const year = date.getFullYear().toString().padStart(4, "0")
        const hour = date.getHours().toString().padStart(2, "0")
        const minute = date.getMinutes().toString().padStart(2, "0")
        const second = date.getSeconds().toString().padStart(2, "0")
        const millis = date.getMilliseconds().toString().padStart(3, "0")
        return `${month}/${day}/${year} ${hour}:${minute}:${second}.${millis}`
    }

    onGridReady = (params: GridReadyEvent) => {
        this.api = params.api;
        this.columnApi = params.columnApi;
    }

    onDataFetched = (data: any) => {
        console.log(data)
        if (data.error) {
            this.setState({error: `Failed to fetch data. Error: ${data.error}`})
            return
        }
        const customCols = {cols: {}}
        const rows = data.map((d: any) => this.getRow(d, customCols))
        this.setState({
            rows, customCols, error: ""
        })
    }

    render() {
        let rows = this.state.rows
        if (this.state.search !== "") {
            rows = rows.filter(r => r.rowText.includes(this.state.search))
        }
        const title = this.props.match.params.topic === undefined ? `Cross-Topic search` : `Messages for topic: ${this.props.match.params.topic}`
        return (
            <>
                <KafkaToolbar
                    title={title}
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                <br />
                { this.props.match.params.topic === undefined ?
                (
                    <MultiTopicsInput onDataFetched={this.onDataFetched} search={this.state.search}></MultiTopicsInput>
                ) : (
                    <SingleTopicInput
                        topic={this.props.match.params.topic}
                        partition={this.props.match.params.partition}
                        onDataFetched={this.onDataFetched}>
                    </SingleTopicInput>
                )}
                { this.state.error && (<Typography color="error">{this.state.error}</Typography>)}
                <div className="ag-theme-balham">
                    <AgGridReact
                        columnDefs={this.getColumnDefs()}
                        rowData={rows}
                        domLayout='autoHeight'
                        defaultColDef={{ sortable: true, filter: true, resizable: true }}
                        onGridReady={this.onGridReady}
                    >
                    </AgGridReact>
                </div>
            </>
        )
    }
}