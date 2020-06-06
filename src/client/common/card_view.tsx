import React from "react";
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import ReactJson from 'react-json-view';

export interface CardViewProps {
    jsonRows: any[];
    searchQuery: string;
}

export const CardView: React.SFC<CardViewProps> = (props) => {
    let rows = props.jsonRows;
    if (props.searchQuery) {
        rows = rows.filter(r => JSON.stringify(r).includes(props.searchQuery))
    }
    return (
        <Card>
            <CardContent>
                <ReactJson src={rows} />
            </CardContent>
        </Card>
    )
}