import React from "react";
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import LoopIcon from '@material-ui/icons/Loop';
import CircularProgress from '@material-ui/core/CircularProgress';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import Grow from '@material-ui/core/Grow';
import Paper from '@material-ui/core/Paper';
import Popper from '@material-ui/core/Popper';
import MenuItem from '@material-ui/core/MenuItem';
import MenuList from '@material-ui/core/MenuList';
import Typography from '@material-ui/core/Typography';
import useRecursiveTimeout from './use_recursive_timeout';

interface Props {
    isRunning: boolean;
    onRun: () => Promise<void>;
    onCancel: () => void;
}

const options = ['Off', '5s', '10s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];
const durations = [0, 5000, 10000, 60000, 5*60000, 15*60000, 30*60000, 60*60000, 120*60000, 24*60*60000];

export const GoButton: React.FunctionComponent<Props> = (props) => {
    const [open, setOpen] = React.useState(false);
    const anchorRef = React.useRef<HTMLDivElement>(null);
    const [refreshInfo, setRefreshInfo] = React.useState({selectedIndex: 0, refreshId: -1});

    useRecursiveTimeout(props.onRun, refreshInfo.selectedIndex > 0 ? durations[refreshInfo.selectedIndex] : null)

    const handleMenuItemClick = (
        event: React.MouseEvent<HTMLLIElement, MouseEvent>,
        index: number,
      ) => {
        setRefreshInfo({selectedIndex: index, refreshId: refreshInfo.refreshId + 1})
        setOpen(false);
      };

      const handleToggle = () => {
        setOpen((prevOpen) => !prevOpen);
      };

      const handleClose = (event: React.MouseEvent<Document, MouseEvent>) => {
        if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
          return;
        }

        setOpen(false);
      };

    return (
    <div>
        <ButtonGroup variant="contained" color={props.isRunning ? "secondary" : "primary"} ref={anchorRef} aria-label="go button" style={{ marginTop: 18 }}>
            <Button
                onClick={() => props.isRunning ? props.onCancel() : props.onRun()} startIcon={props.isRunning ? <CircularProgress size={18} /> : <LoopIcon />}>
                {props.isRunning ? (<>CANCEL</>) : (<>GO</>)}
            </Button>
            <Button
            size="small"
            aria-controls={open ? 'split-button-menu' : undefined}
            aria-expanded={open ? 'true' : undefined}
            aria-label="select refresh frequency"
            aria-haspopup="menu"
            onClick={handleToggle}
            style={{textTransform: "none"}}
            >
                {refreshInfo.selectedIndex !== 0 && (<Typography>{options[refreshInfo.selectedIndex]}</Typography>)}
                <ArrowDropDownIcon />
            </Button>
        </ButtonGroup>
        <Popper open={open} anchorEl={anchorRef.current} role={undefined} transition>
          {({ TransitionProps, placement }) => (
            <Grow
              {...TransitionProps}
              style={{
                transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom',
              }}
            >
              <Paper>
                <ClickAwayListener onClickAway={handleClose}>
                  <MenuList id="split-button-menu">
                    {options.map((option, index) => (
                      <MenuItem
                        key={option}
                        selected={index === refreshInfo.selectedIndex}
                        onClick={(event) => handleMenuItemClick(event, index)}
                      >
                        {option}
                      </MenuItem>
                    ))}
                  </MenuList>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
    </div>
    )
}