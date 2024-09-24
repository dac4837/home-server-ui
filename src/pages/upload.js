import React, {useState} from 'react';
import axios from 'axios';

function Upload() {

  const [file, setFile] = useState()
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

  function handleChange(event) {
    clearMessages()
    setFile(event.target.files[0])
  }
  
  function handleSubmit(event) {
    event.preventDefault()
    const url = '/uploadFile';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    const config = {
      headers: {
        'content-type': 'multipart/form-data',
      },
    };
    axios.post(url, formData, config).then((response) => {
        setSuccessful(true)
        setFile(null)
    }).catch((error)=> {
        setErrorMessage("something went wrong")
    })

  }

  return (
    <div className="container">
      <h1 className="text-center">File upload</h1>
      {successAlert}
      {errorAlert}
        <form onSubmit={handleSubmit}>
          <input className="form-control" type="file" onChange={handleChange}/>
          <button className="btn btn-primary" type="submit">Upload</button>
        </form>
    </div>
  );
}

export default Upload;