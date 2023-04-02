import { useState } from "react";
import axios from "axios";

export default function Hello() {

  const [name, setName ] = useState("")
  const [message, setMessage ] = useState("")
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
    axios.post('/hijames', {name, message})
      .then(function (response) {
        clearMessages()
        setSuccessful(true)
        setName("")
        setMessage("")
      })
      .catch(function (response) { 
        clearMessages()
        const errorMessage = response?.response?.data ? response.response.data : "Error submitting request"

        setErrorMessage(errorMessage)
      });
  }

  return (
    <div className="container">
      <h1 className="text-center">Messages for James!</h1>
      {successAlert}
      {errorAlert}

      <form>
        <div className="mb-3 w-75 ">
          <label for="name" className="form-label">
            Your name
          </label>
          <input type="text" className="form-control" id="name"
          value={name} onChange={(change)=> onInputChange(setName, change)} required />
        </div>
        <div className="mb-3 w-75">
          <label for="message" className="form-label">
            Message
          </label>
          <textarea
            className="form-control"
            id="message"
            value={message}
            onChange={(change) => onInputChange(setMessage, change)}
            placeholder="Share a story, send a wish, or tell 'future James' about his current childhood self! (Favorite activities, what makes him laugh, etc)."
            required
            style={{ height: "300px" }}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={onSubmit}>
          Submit
        </button>
      </form>
    </div>
  );
}
