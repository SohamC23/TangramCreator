import ReactDOM from "react-dom/client";
import "./amplifyConfig"; // Amplify configuration must be imported before any Amplify calls
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);