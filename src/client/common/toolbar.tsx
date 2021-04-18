import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import InputBase from '@material-ui/core/InputBase';
import { fade, makeStyles, withStyles } from '@material-ui/core/styles';
import MenuIcon from '@material-ui/icons/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Menu from '@material-ui/core/Menu';
import SearchIcon from '@material-ui/icons/Search';
import Tooltip from '@material-ui/core/Tooltip';
import GitHubIcon from '@material-ui/icons/GitHub';
import InputAdornment from '@material-ui/core/InputAdornment';
import { Divider } from '@material-ui/core';
import Link from '@material-ui/core/Link';
import { useTheme } from './theme_hook';
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import WbSunnyIcon from '@material-ui/icons/WbSunny';
import NightsStayIcon from '@material-ui/icons/NightsStay';
import Icon from '@mdi/react';
import { mdiRegex, mdiFormatLetterCase } from '@mdi/js';
import { Url } from './url';
import { SearchStyle } from '../../shared/search';

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

interface ThemeProps {
  OnThemeChanged?: (theme: string) => void
}

const ThemeToggle: React.FunctionComponent<ThemeProps> = (props) => {
  const {theme, saveTheme} = useTheme()

  const handleTheme = (event: React.MouseEvent<HTMLElement>, newTheme: string) => {
    if (newTheme !== null) {
      saveTheme(newTheme)
      if (props.OnThemeChanged) {
        props.OnThemeChanged(newTheme)
      }
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

const SearchButtonGroup = withStyles((theme) => ({
  grouped: {
    margin: theme.spacing(0),
    border: 'none',
    borderRadius: theme.shape.borderRadius,
  },
}))(ToggleButtonGroup);

const useSearchButtonStyles = makeStyles((theme) => ({
  root: (props: {selectColor: string, hoverColor: string}) => {
    return {
      '&$selected': {
        backgroundColor: props.selectColor,
      },
      '&:hover': {
        backgroundColor: `${props.hoverColor} !important`,
      },
    }
  },
  selected: (_: {selectColor: string, hoverColor: string}) => { return {}},
}));

function SearchToggleButton(props: any) {
  const { selectColor, hoverColor, ...other } = props;
  const classes = useSearchButtonStyles({ selectColor, hoverColor });
  return <ToggleButton classes={classes} {...other} />;
}

interface Props {
    title: string;
    url: Url;
    hideSearch?: boolean;
    OnThemeChanged?: (theme: string) => void
}

export const KafkaToolbar: React.FunctionComponent<Props> = (props) => {
  const classes = useStyles();
  const [anchorElement, setAnchorElement] = React.useState(null);

  const [searchStyle, setSearchStyle] = React.useState((props.url.Get(`search_style`) || ``) as SearchStyle);
  const [searchPattern, setSearchPattern] = React.useState((props.url.Get(`search`) || ``) );

  const {theme, _} = useTheme()
  const searchButtonColor = theme === `dark` ? `dimgray` : `silver`
  const searchButtonSelectedColor = theme === `dark` ? `rgb(106, 186, 251)` : `rgb(64,82,181)`
  const searchButtonHoverColor = theme === `dark` ? `rgb(131, 197, 251)` : `rgb(82, 97, 183)`

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
                <Link href="/kafka-connect/connectors" color="inherit">
                  <MenuItem>Kafka-Connect (connectors)</MenuItem>
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
          <ThemeToggle OnThemeChanged={props.OnThemeChanged}/>
          {!props.hideSearch && (
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
                value={searchPattern}
                endAdornment={
                  <>
                  <InputAdornment position="end">
                  <SearchButtonGroup
                    size="small"
                    value={searchStyle}
                    exclusive
                    onChange={(e, value) => { setSearchStyle(value); props.url.Set({ name: `search_style`, val: value})}}
                    aria-label="search options"
                  >
                      <SearchToggleButton
                        selectColor={searchButtonSelectedColor}
                        hoverColor={searchButtonHoverColor}
                        aria-label="Match Case"
                        value="case-sensitive"
                      >
                        <Tooltip title="Match Case">
                          <Icon path={mdiFormatLetterCase} size={1} color={searchButtonColor}/>
                        </Tooltip>
                      </SearchToggleButton>
                      <SearchToggleButton
                        selectColor={searchButtonSelectedColor}
                        hoverColor={searchButtonHoverColor}
                        aria-label="Use Regular Expression"
                        value="regex"
                      >
                        <Tooltip title="Use Regular Expression">
                          <Icon path={mdiRegex} size={1} color={searchButtonColor}/>
                        </Tooltip>
                      </SearchToggleButton>
                    </SearchButtonGroup>
                  </InputAdornment>
                  </>
                }
                onChange={e => {
                  props.url.Set({name: `search`, val: e.target.value})
                  setSearchPattern(e.target.value)
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
