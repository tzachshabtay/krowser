import React, { useState, useContext } from 'react';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';

export const ThemeContext = React.createContext(null as any);

export const GlobalThemeProvider = ({ children, theme }: any) => {
    let defaultTheme = window.localStorage.getItem(`theme`)
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)') //this must be outside of the if clause to maintain the rule of hooks
    if (!defaultTheme) {
      defaultTheme = prefersDarkMode ? `dark` : `light`
    }

    const [currentTheme, setCurrentTheme] = useState(
        theme || defaultTheme
    );

    const saveTheme = (values: any) => {
        setCurrentTheme(values)
        window.localStorage.setItem(`theme`, values)
    };

    const materialTheme = React.useMemo(
		() =>
		  createMuiTheme({
			palette: {
			  type: currentTheme,
			},
		  }),
		[currentTheme],
	);

    return (
       <ThemeContext.Provider
          value={{ theme: currentTheme, saveTheme }}
       >
           <ThemeProvider theme={materialTheme}>
           <CssBaseline />
          {children}
          </ThemeProvider>
       </ThemeContext.Provider>
    );
 };

export const useTheme = () => {
    const context = useContext(ThemeContext)
    return context
}