import React from "react";
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, GridApi, ColumnApi, ColDef } from 'ag-grid-community';

import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';

interface Props {
    shouldSearch: boolean;
    search: (row: any) => boolean;
    rows: any[];
    columnDefs: ColDef[];
}

export class Grid extends React.Component<Props> {
    api: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    RefreshCells = () => {
        if (this.api) {
            this.api.refreshCells()
        }
    }

    onGridReady = (params: GridReadyEvent) => {
        this.api = params.api;
        this.columnApi = params.columnApi;
        this.api.refreshCells()
    }

    render() {
        let rows = this.props.rows
        if (this.props.shouldSearch) {
            rows = rows.filter(this.props.search)
        }
        return (
            <div className="ag-theme-balham">
                <AgGridReact
                    columnDefs={this.props.columnDefs}
                    rowData={rows}
                    domLayout='autoHeight'
                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                    onGridReady={this.onGridReady}
                >
                </AgGridReact>
            </div>
        )
    }
}