import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2", // A nice blue color
    },
    secondary: {
      main: "#dc004e", // A pinkish color
    },
    background: {
      default: "#f0f2f5",
      paper: "#ffffff",
    },
    text: {
      primary: "#171717",
      secondary: "#6b7280",
    },
  },
  typography: {
    fontFamily:
      'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    h1: {
      fontSize: "2rem",
      fontWeight: 500,
    },
    h2: {
      fontSize: "1.75rem",
      fontWeight: 500,
    },
    h3: {
      fontSize: "1.5rem",
      fontWeight: 500,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#171717",
          boxShadow: "none",
          borderBottom: "1px solid #e0e0e0",
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          borderTop: "1px solid #e0e0e0",
          height: "65px",
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        label: {
          marginTop: "4px",
          fontSize: "0.7rem",
        },
      },
    },
  },
});

export default theme;
