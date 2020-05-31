import React from "react";
import Button from '@material-ui/core/Button';
import EventNote from '@material-ui/icons/EventNote';

export interface CellProps {
    value?: number;
    data: any;
}

export interface CellButtonProps extends CellProps {
    getUrl: () => string;
}

export class CellButton extends React.Component<CellButtonProps, {}> {
    render() {
        let msg = "Loading"
        if (this.props.value || this.props.value === 0) {
            msg = this.props.value.toString()
        }
        return (
            <div style={{ width: "100%", justifyContent: 'left', textAlign: "left", marginTop: -3 }}>
                <Button color="primary" size="small" style={{ justifyContent: 'left', textAlign: "left" }}
                    onClick={() => { this.props.data.history.push(this.props.getUrl()) }}>
                    <EventNote />
                    {msg}
                </Button>
            </div>
        )
    }
}