import { useState } from "react";
import axios from "axios";

export default function Magic() {

    const [deckUrl, setDeckUrl ] = useState("")
    const [successful, setSuccessful] = useState()
    const [errorMessage, setErrorMessage] = useState()

    const successAlert=( 
        successful && 
        <div className="alert alert-success" role="alert">
          Success!
           </div> 
      )
    
      const errorAlert= ( 
        errorMessage && 
        <div className="alert alert-danger" role="alert">
          Error: {errorMessage}
           </div> 
      )
    
      const clearMessages = () => {
        setSuccessful(false)
        setErrorMessage(null)
      }
    
      const onInputChange = (input, event) => {
        clearMessages()
        input(event.target.value)
    
      }
    
      const onSubmit = () => {
        // axios.post('/hijames', {deckUrl})
        //   .then(function (response) {
        //     clearMessages()
        //     setSuccessful(true)
        //   })
        //   .catch(function (response) { 
        //     clearMessages()
        //     const errorMessage = response?.response?.data ? response.response.data : "Error submitting request"
    
        //     setErrorMessage(errorMessage)
        //   });
        console.log("deckUrl", deckUrl)
        setSuccessful(true)
      }
    

    return (
        <div className="container">
          <h1 className="text-center">Magic Object Downloader</h1>   
          <form>
            <div className="mb-3 w-75 ">
              <label for="deckUrl" className="form-label">
                Deck URL
              </label>
              <input type="text" className="form-control" id="deckUrl"
              value={deckUrl} onChange={(change)=> onInputChange(setDeckUrl, change)} required />
            </div>
            <button type="button" className="btn btn-primary" onClick={onSubmit}>
              Submit
            </button>
          </form>
          {successAlert}
          {errorAlert}
        </div>
      );
}