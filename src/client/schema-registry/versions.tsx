import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import { GridApi, ColumnApi, GridReadyEvent } from 'ag-grid-community';


type State = {
    search: string;
    loading: boolean;
    rows: any[];
    customCols: {cols: {}};
}

export class Versions extends React.Component<RouteComponentProps<{ subject: string }>, State> {
    state: State = { search: "", loading: true, rows: [], customCols: {cols: {}} }
    gridApi: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    onGridReady = (params: GridReadyEvent) => {
        this.gridApi = params.api;
        this.columnApi = params.columnApi;
    }

    async componentDidMount() {
        const response = await fetch(`/api/schema-registry/versions/${this.props.match.params.subject}`)
        const data = await response.json()
        const results = data.map((r: any) => (
            { version: r }))
        this.setState({ loading: false, rows: results })
        const customCols = {cols: {}}
        for (const version of results) {
            await this.fetchSchema(version, customCols)
        }
        this.setState({customCols})
    }

    async fetchSchema(version: any, customCols: {cols: any}) {
        const response = await fetch(`/api/schema-registry/schema/${this.props.match.params.subject}/${version.version}`)
        const data = await response.json()
        version.schema = data
        this.addToRow(version, data, customCols, "")
        if (this.gridApi) {
            this.gridApi.refreshCells()
        }
        this.forceUpdate();
    }

    addToRow = (row: any, data: any, customCols: {cols: any}, prefix: string): any => {
        for (const field of data.fields) {
            const name = `${prefix}${field.name}`
            if (typeof field.type === "object" && field.type.type === "record") {
                this.addToRow(row, field.type, customCols, `${name}->`)
                continue
            }
            row[name] = this.getFieldValue(field)
            customCols.cols[name] = row[name]
        }
    }

    getFieldValue(field: any) {
        if (typeof field.type === "string") {
            return field.type
        }
        if (field.type.type === "enum") {
            const symbols = field.type.symbols.join(`, `)
            return `${field.type.name} (${symbols})`
        }
        if (Array.isArray(field.type)) {
            const union = field.type.join(`, `)
            return `union{ ${union} }`
        }
        return `Unsupported Type`
    }

    getColumnDefs() {
        const cols = [
            { headerName: "Version", field: "version", filter: "agNumberColumnFilter" },
            { headerName: "Type", field: "schema.type" },
            { headerName: "Name", field: "schema.name" },
            { headerName: "Namespace", field: "schema.namespace" },
        ]
        this.addCustomColumns(cols, this.state.customCols.cols, ``)
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

    render() {
        return (
            <>
                <KafkaToolbar
                    title={`Schemas for subject ${this.props.match.params.subject}`}
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.schema.includes(this.state.search)}
                    rows={this.state.rows}
                    raw={this.state.rows.map(r => ({version: r.version, schema: r.schema}))}
                    columnDefs={this.getColumnDefs()}
                    onGridReady={this.onGridReady}
                    >
                </DataView>}
            </>
        )
    }
}