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
import { MsalProvider } from "@azure/msal-react";
import { getMsalInstance } from "./authConfig";
import Hello from "./pages/hello";
import Home from "./pages/home";
import Upload from "./pages/upload";
import Magic from "./pages/magic";
import Files from "./pages/files";
import AuthenticationWrapper from "./components/AuthenticationWrapper";
import LoadingSpinner from "./components/LoadingSpinner";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/hijames" element={<Hello />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/magic" element={<Magic />} />
      <Route path="/auth_callback" element={<LoadingSpinner />} />
      <Route path="/files" element={<AuthenticationWrapper><Files /></AuthenticationWrapper>} />
      <Route path="/" element={<Home />} />
    </>
  )
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <MsalProvider instance={getMsalInstance()}>
    <RouterProvider router={router} />
  </MsalProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
