import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";
import Hello from "./pages/hello";
import Upload from "./pages/upload";
import Magic from "./pages/magic";
import Files from "./pages/files";
import { MsalProvider } from "@azure/msal-react";
import { getMsalInstance } from "./msalconfig";


const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/hijames" element={<Hello />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/magic" element={<Magic />} />
      <Route path="/files" element={<Files />} />
    </>
  )
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <MsalProvider instance={getMsalInstance()}>
      <RouterProvider router={router} />
      </MsalProvider>

  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
