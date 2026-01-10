import { useState, useEffect } from "react";
import axios from "axios";
import { addCardToPile, moveCardBetweenPiles, updateCardInPlace, removeCardFromPile, processDeckData } from "../utils/deckUtils";

export default function Magic() {

  const [deckUrl, setDeckUrl] = useState("")
  const [deckJson, setDeckJson] = useState()
  const [editingCard, setEditingCard] = useState(null)
  const [processedDeck, setProcessedDeck] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', frontUrl: '', backUrl: '', pileId: '', quantity: 1 })
  const [infoMessage, setInfoMessage] = useState()
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [isLoading, setIsLoading] = useState(false)
  
  const downloadDeckJson = (jsonStr) => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getDownloadFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const successAlert = (
    successMessage && (
      <div className="alert alert-success" role="alert">{successMessage}</div>
    )
  )
  const errorAlert = (
    errorMessage && (
      <div className="alert alert-danger" role="alert">Error: {errorMessage}</div>
    )
  )

  const clearMessages = () => {
    setSuccessMessage(null)
    setErrorMessage(null)
    setInfoMessage(null)
  }

  const onInputChange = (input, event) => {
    clearMessages()
    input(event.target.value)
  }

  const getDownloadFileName = () => {
    try {
      if (!deckUrl) return 'deck.json';
      const u = new URL(deckUrl);
      const path = u.pathname.split('/').pop();
      return path ? path.replace(/\.[a-z]+$/i, '') + '.json' : 'deck.json';
    } catch (err) {
      return 'deck.json';
    }
  }

  const onSubmit = async () => {
    clearMessages();
    if (!deckUrl && !process.env.REACT_APP_LOCAL_MODE) {
      setErrorMessage('Enter a deck URL or enable local mode');
      return;
    }
    setIsLoading(true);
    try {
      let data;
      if (process.env.REACT_APP_LOCAL_MODE) {
        const res = await fetch('/deck-response.json');
        data = await res.json();
      } else {
        const res = await axios.get('/magic-json', { params: { deckUrl } });
        data = res.data;
      }
      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
      setDeckJson(jsonStr);
      const processed = processDeckData(data);
      setProcessedDeck(processed);
      setSuccessMessage('Deck loaded');
    } catch (err) {
      console.error('submit error', err);
      setErrorMessage('Failed to load deck');
    } finally {
      setIsLoading(false);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    clearMessages();
    if (!deckJson) return setErrorMessage('No deck loaded to modify');
    const { name, frontUrl, backUrl, pileId, quantity } = addForm;
    if (!name || !frontUrl || !pileId) return setErrorMessage('Name, front image and pile selection are required');

    try {
      const deckObj = JSON.parse(deckJson);

      if (editingCard) {
        const { pileId: origPileId, cardId } = editingCard;
        const origPileIndex = parseInt(origPileId.split('-')[1], 10);
        const newPileIndex = parseInt(pileId.split('-')[1], 10);

        // Update fields in place
        updateCardInPlace(deckObj, origPileIndex, cardId, name, frontUrl, backUrl);

        // Move if target pile changed
        if (pileId !== origPileId) {
          moveCardBetweenPiles(deckObj, origPileIndex, newPileIndex, cardId, name, frontUrl, backUrl);
        }

        const updatedJson = JSON.stringify(deckObj);
        setDeckJson(updatedJson);
        const processed = processDeckData(deckObj);
        setProcessedDeck(processed);
        const pileTitle = processed.find(p => p.id === pileId)?.title || pileId;
        setSuccessMessage(`Updated "${name}" in ${pileTitle}`);
        setEditingCard(null);
        setShowAddForm(false);
        setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: '', quantity: 1 });
        return;
      }

      // Add new card
      const pileIndex = parseInt(pileId.split('-')[1], 10);
      addCardToPile(deckObj, pileIndex, name, frontUrl, backUrl, quantity || 1);
      const updatedJson = JSON.stringify(deckObj);
      setDeckJson(updatedJson);
      const processed = processDeckData(deckObj);
      setProcessedDeck(processed);
      const pileTitle = processed.find(p => p.id === pileId)?.title || pileId;
      setSuccessMessage(`Added "${name}" to ${pileTitle}`);
      setErrorMessage(null);
      setShowAddForm(false);
      setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: '', quantity: 1 });
    } catch (err) {
      console.error('Error modifying deck', err);
      setErrorMessage('Failed to modify deck');
    }
  }
  
  // Lazy React tooltip image - only loads large image when hovered
  function LazyTooltipImage({ smallSrc, largeSrc, alt }) {
    const [show, setShow] = useState(false);
    const [loadedSrc, setLoadedSrc] = useState(null);

    useEffect(() => {
      if (show && largeSrc) {
        // Set loadedSrc to trigger browser download only when hovered
        setLoadedSrc(largeSrc);
      } else {
        setLoadedSrc(null);
      }
    }, [show, largeSrc]);

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={smallSrc}
          alt={alt}
          style={{ width: '50px', height: '70px', cursor: largeSrc ? 'pointer' : 'default' }}
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        />
        {loadedSrc && (
          <img
            src={loadedSrc}
            alt={alt}
            style={{ position: 'absolute', top: '-10px', left: '60px', width: '300px', zIndex: 1000 }}
            className="tooltip-image"
          />
        )}
      </div>
    );
  }

  // Small presentational sub-component for a card row
  function CardRow({ pile, card, onEdit, onDelete }) {
    return (
      <div className="card-item" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginRight: '1rem', position: 'relative' }}>
            <LazyTooltipImage smallSrc={card.frontSmall} largeSrc={card.frontLarge} alt={card.nickname} />
            {card.backSmall && (
              <LazyTooltipImage smallSrc={card.backSmall} largeSrc={card.backLarge} alt={`${card.nickname} Back`} />
            )}
          </div>
          <span style={{ marginRight: '0.75rem' }}>{card.nickname}</span>
          <div>
            <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => onEdit(pile.id, card)}>Edit</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(pile.id, card)}>Remove</button>
          </div>
        </div>
      </div>
    );
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
      <button type="button" className="btn btn-primary me-2" onClick={() => downloadDeckJson(deckJson)}>
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

  function handleAddFormChange(field, value) {
    setAddForm(prev => ({ ...prev, [field]: value }))
  }
  function handleToggleAddForm() {
    // Clear messages
    setInfoMessage(null);
    setErrorMessage(null);
    // If the form is closed, open it and reset to Add mode.
    if (!showAddForm) {
      setEditingCard(null);
      setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: processedDeck.length ? processedDeck[0].id : '', quantity: 1 });
      setShowAddForm(true);
      return;
    }

    // If the form is already open, switch to Add mode without closing it.
    setEditingCard(null);
    setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: processedDeck.length ? processedDeck[0].id : '', quantity: 1 });
  }
  function handleEditCard(pileId, card) {
    // populate form and enter edit mode
    setAddForm({ name: card.nickname || '', frontUrl: card.frontLarge || '', backUrl: card.backLarge || '', pileId });
    setEditingCard({ pileId, cardId: card.cardID });
    setShowAddForm(true);
    setInfoMessage(null);
    setErrorMessage(null);
  }

  function handleDeleteCard(pileId, card) {
    clearMessages();
    if (!deckJson) return setErrorMessage('No deck loaded');
    try {
      const deckObj = JSON.parse(deckJson);
      const pileIndex = parseInt(pileId.split('-')[1], 10);

      removeCardFromPile(deckObj, pileIndex, card.cardID);

      const updatedJson = JSON.stringify(deckObj);
      setDeckJson(updatedJson);
      const processed = processDeckData(deckObj);
      setProcessedDeck(processed);
      setSuccessMessage(`Removed "${card.nickname}"`);
    } catch (err) {
      console.error('delete error', err);
      setErrorMessage('Failed to delete card');
    }
  }

  const deckPreview = processedDeck && processedDeck.length > 0 && (
    <div className="container">
      <h2>Deck JSON Preview</h2>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={handleToggleAddForm}>Add Card</button>
              </div>

              {processedDeck.map((pile) => (
                <div key={pile.id} style={{ marginBottom: '1.5rem' }}>
                  <h4>{pile.title}</h4>
                  <div className="card-list">
                    {pile.cards.map((card) => (
                      <CardRow key={card.id} pile={pile} card={card} onEdit={handleEditCard} onDelete={handleDeleteCard} />
                    ))}
                  </div>
                </div>
              ))}
        </div>

        <div style={{ width: 360, alignSelf: 'flex-start', position: 'sticky', top: '1rem', height: 'fit-content' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            {showAddForm ? (
              <button className="btn btn-secondary" onClick={() => { setShowAddForm(false); setEditingCard(null); setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: '', quantity: 1 }); }}>Close</button>
            ) : null}
          </div>

          {infoMessage && <div className="alert alert-success">{infoMessage}</div>}
          {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

          {showAddForm && (
            <form onSubmit={handleFormSubmit} className="card p-3">
              <div className="mb-2">
                <label className="form-label">Name</label>
                <input className="form-control" value={addForm.name} onChange={e => handleAddFormChange('name', e.target.value)} />
              </div>
              <div className="mb-2">
                <label className="form-label">Front image URL</label>
                <input className="form-control" value={addForm.frontUrl} onChange={e => handleAddFormChange('frontUrl', e.target.value)} />
              </div>
              <div className="mb-2">
                <label className="form-label">Back image URL (optional)</label>
                <input className="form-control" value={addForm.backUrl} onChange={e => handleAddFormChange('backUrl', e.target.value)} />
                {addForm.pileId && processedDeck.find(p => p.id === addForm.pileId)?.title === 'Mainboard' && addForm.backUrl && addForm.backUrl.trim() !== '' && (
                  <div className="form-text text-warning">Double sided version will be added to "Double-sided Cards" as well</div>
                )}
              </div>
              {!editingCard && (
                <div className="mb-2">
                  <label className="form-label">Quantity</label>
                  <input type="number" min="1" className="form-control" value={addForm.quantity} onChange={e => handleAddFormChange('quantity', Number(e.target.value || 1))} />
                </div>
              )}
              <div className="mb-2">
                <label className="form-label">Pile</label>
                <select className="form-select" value={addForm.pileId} onChange={e => handleAddFormChange('pileId', e.target.value)}>
                  <option value="">Select pile</option>
                  {processedDeck.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="d-grid">
                <button type="submit" className="btn btn-primary">{editingCard ? 'Save Changes' : 'Add Card'}</button>
                {editingCard && <button type="button" className="btn btn-secondary mt-2" onClick={() => { setEditingCard(null); setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: '', quantity: 1 }); setShowAddForm(false); }}>Cancel</button>}
              </div>
            </form>
          )}
        </div>
      </div>
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
      {deckPreview}
    </div>
  );
}