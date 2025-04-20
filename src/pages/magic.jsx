import { useState } from "react";
import axios from "axios";

export default function Magic() {

  const [deckUrl, setDeckUrl] = useState("")
  const [deckJson, setDeckJson] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [isLoading, setIsLoading] = useState(false)

  const successAlert = (
    deckJson &&
    <div className="alert alert-success" role="alert">
      {getDownloadFileName()} generated successfully!
    </div>
  )

  const errorAlert = (
    errorMessage &&
    <div className="alert alert-danger" role="alert">
      Error: {errorMessage}
    </div>
  )

  const clearMessages = () => {
    setDeckJson(null)
    setErrorMessage(null)
    setIsLoading(false)
  }

  const onInputChange = (input, event) => {
    clearMessages()
    input(event.target.value)

  }

  const onSubmit = () => {
    setDeckJson(null)
    setIsLoading(true)
    axios.get('/magic-json', { params: { deckUrl } })
      .then(function (response) {
        clearMessages();
        setDeckJson(JSON.stringify(response.data));
      })
      .catch(function (error) {
        clearMessages();
        setErrorMessage(error?.response?.data || "Error fetching data");
      });

  }

  function getDownloadFileName() {
    const url = new URL(deckUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);
    return `${pathParts[pathParts.length - 1]}.json`;
  }

  const loadingSpinner = isLoading && (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        zIndex: 9999
      }}
    >
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>)

  const deckDisplay = deckJson && (
    <div className="container">
      <button
        type="button"
        className="btn btn-primary me-2"
        onClick={() => {
          const blob = new Blob([deckJson], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = getDownloadFileName();
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
      >
        Download Deck JSON
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => navigator.clipboard.writeText(JSON.stringify(deckJson))}
      >
        Copy to Clipboard
      </button>
    </div>
  )


  return (
    <div className="container">
      <h1 className="text-center">Magic Object Downloader</h1>
      <form>
        <div className="mb-3 w-75">
          <label htmlFor="deckUrl" className="form-label">
            Deck URL
          </label>
          <input
            type="text"
            className="form-control"
            id="deckUrl"
            value={deckUrl}
            onChange={(change) => onInputChange(setDeckUrl, change)}
            required
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={onSubmit}>
          Submit
        </button>
      </form>
      {loadingSpinner}
      {successAlert}
      {errorAlert}
      {deckDisplay}
    </div>
  );
}