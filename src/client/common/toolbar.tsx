import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import InputBase from '@material-ui/core/InputBase';
import { fade, makeStyles } from '@material-ui/core/styles';
import MenuIcon from '@material-ui/icons/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Menu from '@material-ui/core/Menu';
import SearchIcon from '@material-ui/icons/Search';
import Tooltip from '@material-ui/core/Tooltip';
import GitHubIcon from '@material-ui/icons/GitHub';
import { Divider } from '@material-ui/core';
import Link from '@material-ui/core/Link';
import { useTheme } from './theme_hook';
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import WbSunnyIcon from '@material-ui/icons/WbSunny';
import NightsStayIcon from '@material-ui/icons/NightsStay';
import { Url } from './url';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  menuButton: {
    marginRight: theme.spacing(2),
  },
  title: {
    flexGrow: 1,
    display: 'none',
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  },
  search: {
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: fade(theme.palette.common.white, 0.15),
    '&:hover': {
      backgroundColor: fade(theme.palette.common.white, 0.25),
    },
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing(1),
      width: 'auto',
    },
  },
  searchIcon: {
    padding: theme.spacing(0, 2),
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRoot: {
    color: 'inherit',
  },
  inputInput: {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)}px)`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: '12ch',
      '&:focus': {
        width: '20ch',
      },
    },
  },
}));

const ThemeToggle: React.FunctionComponent = () => {
  const {theme, saveTheme} = useTheme()

  const handleTheme = (event: React.MouseEvent<HTMLElement>, newTheme: string) => {
    if (newTheme !== null) {
      saveTheme(newTheme)
    }
  };

  const color = theme === `dark` ? `black` : `white`

  return (
    <ToggleButtonGroup
      value={theme}
      exclusive
      onChange={handleTheme}
      aria-label="theme selector"
    >
      <ToggleButton value="light" aria-label="light theme">
        <WbSunnyIcon htmlColor={color} />
      </ToggleButton>
      <ToggleButton value="dark" aria-label="dark theme">
        <NightsStayIcon htmlColor={color} />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

interface Props {
    title: string;
    onSearch?: React.ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>;
    searchText?: string;
    url: Url;
}

export const KafkaToolbar: React.FunctionComponent<Props> = (props) => {
  const classes = useStyles();
  const [anchorElement, setAnchorElement] = React.useState(null);

  const menuOpen = Boolean(anchorElement);
  const openMenu = (event: any) => {
    setAnchorElement(event.currentTarget);
  };
  const closeMenu = () => {
    setAnchorElement(null);
  };

  return (
    <div className={classes.root}>
      <AppBar position="sticky">
        <Toolbar>
          <IconButton
            edge="start"
            className={classes.menuButton}
            color="inherit"
            aria-label="open drawer"
            onClick={openMenu}
          >
            <MenuIcon />
          </IconButton>
          <Menu
                id="menu-appbar"
                anchorEl={anchorElement}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                open={menuOpen}
                onClose={closeMenu}
              >
                <Link href="/" color="inherit">
                  <MenuItem>Kafka (topics)</MenuItem>
                </Link>
                <Link href="/brokers" color="inherit">
                  <MenuItem>Kafka (brokers)</MenuItem>
                </Link>
                <Link href="/groups" color="inherit">
                  <MenuItem>Kafka (groups)</MenuItem>
                </Link>
                <Link href="/schema-registry/subjects" color="inherit">
                  <MenuItem>Schema-Registry (subjects)</MenuItem>
                </Link>
                <Divider/>
                <Link href="/topics/messages" color="inherit">
                  <MenuItem><SearchIcon /> Search across topics</MenuItem>
                </Link>
            </Menu>
          <Typography className={classes.title} variant="h6" noWrap>
          <Link href="/" color="inherit">
            Krowser
          </Link>
          </Typography>
          <Typography className={classes.title} variant="h6" noWrap>
            {props.title}
          </Typography>
          <ThemeToggle/>
          {props.onSearch && (
            <div className={classes.search}>
                <div className={classes.searchIcon}>
                <SearchIcon />
                </div>
                <InputBase
                placeholder="Search…"
                classes={{
                    root: classes.inputRoot,
                    input: classes.inputInput,
                }}
                inputProps={{ 'aria-label': 'search' }}
                value={props.searchText}
                onChange={e => {
                  props.url.Set({name: `search`, val: e.target.value})
                  if (props.onSearch) {
                    props.onSearch(e)
                  }
                }}
                />
            </div>
          )}
          <Tooltip title="Source Code" aria-label="source code">
            <IconButton color="inherit" target="_blank" href="https://github.com/tzachshabtay/krowser/">
                <GitHubIcon />
            </IconButton>
          </Tooltip >
        </Toolbar>
      </AppBar>
    </div>
  );
}
