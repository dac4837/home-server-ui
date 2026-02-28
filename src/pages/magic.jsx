import { useState, useEffect } from "react";
import axios from "axios";
import { addCardToPile, moveCardBetweenPiles, updateCardInPlace, removeCardFromPile, processDeckData, convertToTableTop } from "../utils/deckUtils";

export default function Magic() {

  const BASIC_LANDS = {
    forest: 'https://cards.scryfall.io/png/front/e/d/ed22c591-19f4-4096-a08c-5523a26b307c.png?1738799053',
    plains: 'https://cards.scryfall.io/png/front/5/d/5d918248-85ff-4fea-ac91-aa5466dd2829.png?1681845990',
    swamp: 'https://cards.scryfall.io/png/front/a/2/a22f49c5-1dcd-453c-b169-0b2519c44d0c.png?1695483859',
    mountain: 'https://cards.scryfall.io/png/front/8/a/8a05eb4e-dbea-4d41-939f-b9d92b56f56a.png?1605219735',
    island: 'https://cards.scryfall.io/png/front/9/3/93b0918a-398a-4c6d-a5a9-e35a999b24ae.png?1594958716',
    wastes: 'https://cards.scryfall.io/png/front/7/0/7019912c-bd9b-4b96-9388-400794909aa1.png?1562917413'
  };
  
  const LAND_ICON_STYLE = { width: 26, height: 26, cursor: 'pointer' }

  const [deckUrl, setDeckUrl] = useState("")
  const [mode, setMode] = useState('url')
  const [deckJson, setDeckJson] = useState()
  const [uploadedFileName, setUploadedFileName] = useState(null)
  const [editingCard, setEditingCard] = useState(null)
  const [processingArtOptions, setProcessingArtOptions] = useState(null)
  const [artOptions, setArtOptions] = useState([])
  const [artOptionsLoading, setArtOptionsLoading] = useState(false)
  const [processedDeck, setProcessedDeck] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', frontUrl: '', backUrl: '', pileId: '', quantity: 1 })
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [isLoading, setIsLoading] = useState(false)
  
  // Helper: Reset add form to initial state
  const resetAddForm = () => setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: '', quantity: 1 })
  
  // Helper: Close all side panels
  const closeAllPanels = () => {
    setShowAddForm(false);
    setProcessingArtOptions(null);
    setArtOptions([]);
    setArtOptionsLoading(false);
    setEditingCard(null);
    resetAddForm();
  }
  
  // Helper: Update deck state after modifications
  const updateDeckState = (deckObj, successMsg) => {
    const jsonStr = JSON.stringify(deckObj);
    setDeckJson(jsonStr);
    const processed = processDeckData(deckObj);
    setProcessedDeck(processed);
    if (successMsg) setSuccessMessage(successMsg);
  }
  
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

  // Small UI components
  function ModeSelector({ mode, onChange }) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ fontWeight: 600 }}>I want to generate a deck from...</div>
        <div>
          <button type="button" className={`btn ${mode === 'url' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm me-1`} onClick={() => onChange('url')}>A deck url</button>
          <button type="button" className={`btn ${mode === 'photos' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm me-1`} onClick={() => onChange('photos')}>Photos of my cards</button>
          <button type="button" className={`btn ${mode === 'file' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm`} onClick={() => onChange('file')}>An existing deck file</button>
        </div>
      </div>
    )
  }

  function DeckUrlForm() {
    return (
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <div className="mb-3 w-75">
          <label htmlFor="deckUrl" className="form-label">Deck URL</label>
          <input type="text" className="form-control" id="deckUrl" value={deckUrl} onChange={(change) => onInputChange(setDeckUrl, change)} required />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={isLoading}>{isLoading ? 'Loading…' : 'Submit'}</button>
        </div>
      </form>
    )
  }

  function JsonUploadForm() {
    return (
      <div>
        <div className="mb-3 w-75">
          <label htmlFor="deckFile" className="form-label">Upload deck JSON</label>
          <input type="file" accept="application/json" className="form-control" id="deckFile" onChange={handleFileUpload} />
        </div>
      </div>
    )
  }

  // Photo upload form: sends 1-3 images to backend /magic-deck-json-from-photo
  function PhotoUploadForm() {
    const [photos, setPhotos] = useState([]);

    function onPhotosChange(e) {
      const files = e.target.files ? Array.from(e.target.files).slice(0, 3) : [];
      setPhotos(files);
    }

    async function onPhotoSubmit(e) {
      e.preventDefault();
      clearMessages();

      if (!photos || photos.length === 0) {
        setErrorMessage('Select 1-3 images to upload');
        return;
      }

      setIsLoading(true);
      try {
        const formData = new FormData();
        photos.forEach((f) => formData.append('photo', f));

        const res = await axios.post('/magic-deck-json-from-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const data = res && res.data ? res.data : {};

        if (data && data.deckJson) {
          const jsonStr = JSON.stringify(data.deckJson);
          setDeckJson(jsonStr);
          const processed = processDeckData(data.deckJson);
          setProcessedDeck(processed);
          setUploadedFileName(`deck.json`);
          setSuccessMessage(data.message || 'Deck generated from photos');
        } else {
          const msg = data && (data.message || data.error) ? (data.message || data.error) : 'No deck JSON returned';
          setErrorMessage(msg);
        }
      } catch (err) {
        console.error('photo upload error', err);
        const serverMsg = err && err.response && (err.response.data && (err.response.data.error || err.response.data.message));
        setErrorMessage(serverMsg || err.message || 'Failed to upload photos');
      } finally {
        setIsLoading(false);
      }
    }

    return (
      <form onSubmit={onPhotoSubmit} className="mb-3">
        <div className="mb-3 w-75">
          <label htmlFor="photoFiles" className="form-label">Upload 1-3 photos</label>
          <input id="photoFiles" type="file" accept="image/*" multiple className="form-control" onChange={onPhotosChange} />
          <div className="form-text">Select up to 3 images. Submit will send images to the server to detect card titles.</div>
          {photos && photos.length > 0 && (
            <div className="form-text mt-2">Selected: {photos.map(p => p.name).join(', ')}</div>
          )}
        </div>
        <div>
          <button type="submit" className="btn btn-primary" disabled={!photos || photos.length === 0}>Submit Photos</button>
        </div>
      </form>
    )
  }

  const renderAlert = (message, type = 'success') => (
    message && (
      <div className={`alert alert-${type}`} role="alert">
        {type === 'danger' ? 'Error: ' : ''}{message}
      </div>
    )
  )
  
  const successAlert = renderAlert(successMessage, 'success')
  const errorAlert = renderAlert(errorMessage, 'danger')

  const clearMessages = () => {
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  const onInputChange = (input, event) => {
    clearMessages()
    input(event.target.value)
  }

  const getDownloadFileName = () => {
    try {
      const ts = Date.now();
      // If user uploaded a file, base on that name
      if (uploadedFileName) {
        const base = uploadedFileName.split('/').pop().replace(/\.[^/.]+$/, '');
        return `${base}-${ts}.json`;
      }
      if (!deckUrl) return `deck-${ts}.json`;
      const u = new URL(deckUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      const slug = parts.length ? parts[parts.length - 1] : 'deck';
      return `${slug}-${ts}.json`;

    } catch (err) {
      return `deck-${Date.now()}.json`;
    }
  }

  // Fixed pile ids -> titles used throughout the UI
  const PILE_TITLE_MAP = {
    'pile-mainboard': 'Mainboard',
    'pile-commander': 'Commander',
    'pile-tokens': 'Tokens',
    'pile-double': 'Double-sided Cards'
  };

  function findPileIndexByProcessedId(deckObj, processedId) {
    const title = PILE_TITLE_MAP[processedId] || processedId;
    return deckObj.ObjectStates.findIndex(p => p && ((p.Description === title) || (p.Nickname === title)));
  }

  function getOrCreatePileIndex(deckObj, processedId) {
    const idx = findPileIndexByProcessedId(deckObj, processedId);
    if (idx !== -1) return idx;
    const title = PILE_TITLE_MAP[processedId] || processedId;
    const created = {
      Name: 'DeckCustom',
      Nickname: title,
      Description: title,
      ContainedObjects: [],
      DeckIDs: [],
      CustomDeck: {},
      Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
    };
    if (!Array.isArray(deckObj.ObjectStates)) deckObj.ObjectStates = [];
    deckObj.ObjectStates.push(created);
    return deckObj.ObjectStates.length - 1;
  }

  const onSubmit = async () => {
    clearMessages();
    if (!deckUrl && !process.env.REACT_APP_LOCAL_MODE) {
      setErrorMessage('Enter a deck URL or enable local mode');
      return;
    }
    setIsLoading(true);
    try {
      let cardData;
      if (process.env.REACT_APP_LOCAL_MODE) {
        const res = await fetch('/deck-response.json');
        cardData = await res.json();
      } else {
        const res = await axios.get('/magic-cards-json', { params: { deckUrl } });
        cardData = res.data;
      }
      // Convert card data to TableTop format
      const deckObj = convertToTableTop(cardData);
      updateDeckState(deckObj, 'Deck loaded');
    } catch (err) {
      console.error('submit error', err);
      setErrorMessage('Failed to load deck');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle uploading a previously generated deck JSON file
  function handleFileUpload(e) {
    clearMessages();
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const parsed = typeof text === 'string' ? JSON.parse(text) : text;
        const jsonStr = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
        setDeckJson(jsonStr);
        const processed = processDeckData(parsed);
        setProcessedDeck(processed);
        setSuccessMessage(`Loaded deck from ${file.name}`);
      } catch (err) {
        console.error('file parse error', err);
        setErrorMessage('Failed to parse uploaded JSON');
      }
    };
    reader.readAsText(file);
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
        const origPileIndex = findPileIndexByProcessedId(deckObj, origPileId);
        let newPileIndex = findPileIndexByProcessedId(deckObj, pileId);
        if (newPileIndex === -1) {
          newPileIndex = getOrCreatePileIndex(deckObj, pileId);
        }

        // Update fields in place
        const actualOrig = origPileIndex !== -1 ? origPileIndex : deckObj.ObjectStates.findIndex(p => Array.isArray(p && p.ContainedObjects) && p.ContainedObjects.some(c => c.CardID === cardId));
        if (actualOrig !== -1) updateCardInPlace(deckObj, actualOrig, cardId, name, frontUrl, backUrl);

        // Move if target pile changed
        if (newPileIndex !== actualOrig) {
          moveCardBetweenPiles(deckObj, actualOrig, newPileIndex, cardId, name, frontUrl, backUrl);
        }

        const pileTitle = PILE_TITLE_MAP[pileId] || pileId;
        updateDeckState(deckObj, `Updated "${name}" in ${pileTitle}`);
        closeAllPanels();
        return;
      }

      // Add new card
      const targetIndex = getOrCreatePileIndex(deckObj, pileId);
      addCardToPile(deckObj, targetIndex, name, frontUrl, backUrl, quantity || 1);
      const pileTitle = PILE_TITLE_MAP[pileId] || pileId;
      updateDeckState(deckObj, `Added "${name}" to ${pileTitle}`);
      closeAllPanels();
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
  function CardRow({ pile, card, onEdit, onDelete, onArtOptions }) {
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
            <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => onArtOptions(pile.id, card)}>Art Options</button>
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
    clearMessages();
    // Close art options if open
    setProcessingArtOptions(null);
    setArtOptions([]);
    setArtOptionsLoading(false);
    
    // If the form is closed, open it and reset to Add mode.
    if (!showAddForm) {
      setEditingCard(null);
      setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: 'pile-mainboard', quantity: 1 });
      setShowAddForm(true);
      return;
    }

    // If the form is already open, switch to Add mode without closing it.
    setEditingCard(null);
    setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: processedDeck.length ? processedDeck[0].id : '', quantity: 1 });
  }
  function handleEditCard(pileId, card) {
    clearMessages();
    // Close art options if open
    setProcessingArtOptions(null);
    setArtOptions([]);
    setArtOptionsLoading(false);
    
    // Populate form and enter edit mode
    setAddForm({ name: card.nickname || '', frontUrl: card.frontLarge || '', backUrl: card.backLarge || '', pileId });
    setEditingCard({ pileId, cardId: card.cardID });
    setShowAddForm(true);
  }

  function handleDeleteCard(pileId, card) {
    clearMessages();
    if (!deckJson) return setErrorMessage('No deck loaded');
    try {
      const deckObj = JSON.parse(deckJson);
      const pileIndex = findPileIndexByProcessedId(deckObj, pileId);
      if (pileIndex === -1) {
        // fallback: try to find by card id
        const fallback = deckObj.ObjectStates.findIndex(p => Array.isArray(p && p.ContainedObjects) && p.ContainedObjects.some(c => c.CardID === card.cardID));
        if (fallback !== -1) {
          removeCardFromPile(deckObj, fallback, card.cardID);
        } else {
          return setErrorMessage('Could not locate card pile');
        }
      } else {
        removeCardFromPile(deckObj, pileIndex, card.cardID);
      }

      updateDeckState(deckObj, `Removed "${card.nickname}"`);
    } catch (err) {
      console.error('delete error', err);
      setErrorMessage('Failed to delete card');
    }
  }

  async function handleArtOptions(pileId, card) {
    clearMessages();
    // Close add form if open
    setShowAddForm(false);
    resetAddForm();
    
    setProcessingArtOptions({ pileId, card });
    setArtOptionsLoading(true);
    try {
      const encodedName = encodeURIComponent(`!"${card.nickname}" include:extras`);
      const res = await axios.get(`https://api.scryfall.com/cards/search?q=${encodedName}&unique=prints`);
      const cards = res.data.data || [];
      setArtOptions(cards);
    } catch (err) {
      console.error('art options error', err);
      setErrorMessage('Failed to load art options');
    } finally {
      setArtOptionsLoading(false);
    }
  }

  function handleSelectArt(cardOption) {
    if (!processingArtOptions) return;
    
    const { pileId, card: originalCard } = processingArtOptions;
    
    try {
      const deckObj = JSON.parse(deckJson);
      const pileIndex = findPileIndexByProcessedId(deckObj, pileId);
      
      if (pileIndex === -1) {
        setErrorMessage('Could not find pile');
        return;
      }
      
      const pile = deckObj.ObjectStates[pileIndex];
      
      // Extract image URLs from card option
      let frontUrl = null;
      let backUrl = null;
      let isDoubleSided = false;
      
      if (cardOption.card_faces && cardOption.card_faces.length > 1) {
        // Double-sided card
        isDoubleSided = true;
        frontUrl = cardOption.card_faces[0].image_uris?.large;
        backUrl = cardOption.card_faces[1].image_uris?.large;
      } else if (cardOption.image_uris) {
        // Single-sided card
        frontUrl = cardOption.image_uris.large;
      }
      
      if (!frontUrl) {
        setErrorMessage('Selected card has no image');
        return;
      }
      
      // Use the full card name from the API (which may include "Front // Back" for double-sided cards)
      const cardName = cardOption.name;
      
      // Find the card in the pile by its CardID (unique identifier)
      const containedObj = pile.ContainedObjects?.find(obj => obj.CardID === originalCard.cardID);
      
      if (!containedObj) {
        setErrorMessage(`Could not locate card by ID ${originalCard.cardID} in pile`);
        return;
      }
      
      // Update CustomDeck entry
      const slotKey = Math.floor(originalCard.cardID / 100).toString();
      if (pile.CustomDeck && pile.CustomDeck[slotKey]) {
        pile.CustomDeck[slotKey].FaceURL = frontUrl;
        if (backUrl) {
          pile.CustomDeck[slotKey].BackURL = backUrl;
        }
      }
      
      // Update ContainedObjects nickname with the full card name from the API
      if (containedObj.Nickname !== cardName) {
        containedObj.Nickname = cardName;
      }
      
      updateDeckState(deckObj, `Updated art for "${cardName}"`);
      setProcessingArtOptions(null);
      setArtOptions([]);
    } catch (err) {
      console.error('select art error', err);
      setErrorMessage('Failed to update card art');
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
                      <CardRow key={card.id} pile={pile} card={card} onEdit={handleEditCard} onDelete={handleDeleteCard} onArtOptions={handleArtOptions} />
                    ))}
                  </div>
                </div>
              ))}
        </div>

        <div style={{ width: 360, alignSelf: 'flex-start', position: 'sticky', top: '1rem', height: 'fit-content', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            {showAddForm || processingArtOptions ? (
              <button className="btn btn-secondary" onClick={closeAllPanels}>Close</button>
            ) : null}
          </div>

          {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

          {processingArtOptions && (
            <div className="card p-3">
              <h5 style={{ marginBottom: '1rem' }}>Art Options for: {processingArtOptions.card.nickname}</h5>
              
              {artOptionsLoading ? (
                <div className="text-center" style={{ padding: '2rem' }}>
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p>Loading art options...</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {artOptions.length === 0 ? (
                    <p className="text-muted">No alt art found</p>
                  ) : (
                    artOptions.map((cardOption, idx) => {
                      let imageUrl = null;
                      
                      // Get the image URL
                      if (cardOption.image_uris?.normal) {
                        imageUrl = cardOption.image_uris.normal;
                      } else if (cardOption.card_faces?.[0]?.image_uris?.normal) {
                        imageUrl = cardOption.card_faces[0].image_uris.normal;
                      }
                      
                      return (
                        <div
                          key={idx}
                          style={{
                            cursor: imageUrl ? 'pointer' : 'default',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            transition: 'transform 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          onClick={() => imageUrl && handleSelectArt(cardOption)}
                        >
                          {imageUrl ? (
                            <img src={imageUrl} alt={cardOption.name} style={{ width: '100%', height: 'auto', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}>
                              <span className="text-muted" style={{ fontSize: '0.75rem' }}>No image</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

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
                <>
                  <div className="mb-2">
                    <label className="form-label">Basic Land</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <img src="/mtg/forest.svg" alt="Forest" title="Forest" style={LAND_ICON_STYLE} onClick={() => { handleAddFormChange('frontUrl', BASIC_LANDS.forest); handleAddFormChange('name', 'Forest'); }} />
                      <img src="/mtg/island.svg" alt="Island" title="Island" style={LAND_ICON_STYLE} onClick={() => { handleAddFormChange('frontUrl', BASIC_LANDS.island); handleAddFormChange('name', 'Island'); }} />
                      <img src="/mtg/swamp.svg" alt="Swamp" title="Swamp" style={LAND_ICON_STYLE} onClick={() => { handleAddFormChange('frontUrl', BASIC_LANDS.swamp); handleAddFormChange('name', 'Swamp'); }} />
                      <img src="/mtg/mountain.svg" alt="Mountain" title="Mountain" style={LAND_ICON_STYLE} onClick={() => { handleAddFormChange('frontUrl', BASIC_LANDS.mountain); handleAddFormChange('name', 'Mountain'); }} />
                      <img src="/mtg/plains.svg" alt="Plains" title="Plains" style={LAND_ICON_STYLE} onClick={() => { handleAddFormChange('frontUrl', BASIC_LANDS.plains); handleAddFormChange('name', 'Plains'); }} />
                      <img src="/mtg/wastes.svg" alt="Wastes" title="Wastes" style={LAND_ICON_STYLE} onClick={() => { handleAddFormChange('frontUrl', BASIC_LANDS.wastes); handleAddFormChange('name', 'Wastes'); }} />
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Quantity</label>
                    <input type="number" min="1" className="form-control" value={addForm.quantity} onChange={e => handleAddFormChange('quantity', Number(e.target.value || 1))} />
                  </div>
                </>
              )}
              <div className="mb-2">
                <label className="form-label">Pile</label>
                <select className="form-select" value={addForm.pileId} onChange={e => handleAddFormChange('pileId', e.target.value)}>
                  {Object.entries(PILE_TITLE_MAP).map(([id, title]) => (
                    <option key={id} value={id}>{title}</option>
                  ))}
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

      <ModeSelector mode={mode} onChange={(m) => { clearMessages(); setMode(m); }} />

      {mode === 'url' && <DeckUrlForm />}
      {mode === 'photos' && <PhotoUploadForm />}
      {mode === 'file' && <JsonUploadForm />}

      {loadingSpinner}
      {successAlert}
      {errorAlert}
      {deckDisplay}
      {deckPreview}
    </div>
  );
}