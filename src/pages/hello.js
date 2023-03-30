export default function Hello() {
  return (
    <div className="container">
      <h1 className="text-center">James Guestbook</h1>
      <div class="alert alert-light" role="alert">
        Share a memory or message for James to cherish when he becomes an adult!
      </div>

      <form method="post">
        <div className="mb-3 w-75 ">
          <label for="name" class="form-label">
            Your name
          </label>
          <input type="text" className="form-control" id="name" name="name" required />
        </div>
        <div className="mb-3 w-75">
          <label for="message" class="form-label">
            Message
          </label>
          <textarea
            className="form-control"
            id="message"
            name="message"
            placeholder="Share a story, send a wish, or tell 'future James' about his current childhood self! (Favorite activities, what makes him laugh, etc)."
            required
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
