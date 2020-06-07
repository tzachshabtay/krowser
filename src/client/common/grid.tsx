import React from "react";
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, GridApi, ColumnApi, ColDef, FilterChangedEvent } from 'ag-grid-community';

import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-alpine.css';

export interface GridProps {
    searchQuery: string;
    search: (row: any) => boolean;
    rows: any[];
    columnDefs: ColDef[];
    onGridReady?(event: GridReadyEvent): void;
    onFilterChanged?(event: FilterChangedEvent): void;
}

export class Grid extends React.Component<GridProps> {
    api: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    GetGridApi = (): GridApi | null => {
        return this.api
    }

    onGridReady = (params: GridReadyEvent) => {
        this.api = params.api;
        this.columnApi = params.columnApi;
        if (this.props.onGridReady) {
            this.props.onGridReady(params)
        }
    }

    render() {
        let rows = this.props.rows
        if (this.props.searchQuery) {
            rows = rows.filter(this.props.search)
        }
        return (
            <div className="ag-theme-alpine">
                <AgGridReact
                    columnDefs={this.props.columnDefs}
                    rowData={rows}
                    domLayout='autoHeight'
                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                    onGridReady={this.onGridReady}
                    onFilterChanged={this.props.onFilterChanged}
                >
                </AgGridReact>
            </div>
        )
    }
}