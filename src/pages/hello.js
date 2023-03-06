export default function Hello() {
  return (
    <div className="container">
      <h1 className="text-center">Send a message to James!</h1>
      <div class="alert alert-light" role="alert">
        Use this site to write a message for James when he's older. Messages are
        not guaranteed to be read at desired age and may be read by David/Pearly
        in advance
      </div>

      <form>
        <div className="mb-3 w-25 ">
          <label for="name" class="form-label">
            Your name
          </label>
          <input type="text" className="form-control" id="name" />
        </div>
        <div className="mb-3 w-75">
          <label for="message" class="form-label">
            Message
          </label>
          <textarea
            className="form-control"
            id="message"
            style={{ height: "300px" }}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Submit
        </button>
      </form>
    </div>
  );
}
