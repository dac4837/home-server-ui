import { useState, useEffect } from "react";
import axios from "axios";

// TODO make sure the cards are put in the 
// TODO double face cards are added correctly (2 piles )
// non-scryfall images
 // Add multiple at once


export default function Magic() {

  const [deckUrl, setDeckUrl] = useState("")
  const [deckJson, setDeckJson] = useState()
  const [editingCard, setEditingCard] = useState(null)
  const [processedDeck, setProcessedDeck] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', frontUrl: '', backUrl: '', pileId: '' })
  const [infoMessage, setInfoMessage] = useState()
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [isLoading, setIsLoading] = useState(false)

  // Constants and small helpers to keep big methods readable
  const DEFAULT_BACK = 'https://i.imgur.com/Hg8CwwU.jpeg';

  const computeNewCardId = (deckObj) => {
    const allDeckIDs = deckObj.ObjectStates.flatMap(p => p.DeckIDs || []);
    const maxDeckID = allDeckIDs.length ? Math.max(...allDeckIDs) : 0;
    const newSlot = Math.floor(maxDeckID / 100) + 1;
    const newCardID = newSlot * 100;
    return { newCardID, newSlot };
  };

  const ensureCustomDeckEntry = (pile, slot, face, back) => {
    if (!pile.CustomDeck) pile.CustomDeck = {};
    pile.CustomDeck[String(slot)] = { FaceURL: face, BackURL: back && back.length ? back : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true };
  };

  const addCardToPile = (deckObj, pileIndex, name, frontUrl, backUrl) => {
    const { newCardID, newSlot } = computeNewCardId(deckObj);
    const targetPile = deckObj.ObjectStates[pileIndex];
    const customDeckKey = String(newSlot);

    if (targetPile && Array.isArray(targetPile.ContainedObjects)) {
      const newContained = { CardID: newCardID, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } };
      targetPile.ContainedObjects.unshift(newContained);
      if (!Array.isArray(targetPile.DeckIDs)) targetPile.DeckIDs = [];
      targetPile.DeckIDs.unshift(newCardID);
      ensureCustomDeckEntry(targetPile, newSlot, frontUrl, backUrl);
    } else {
      const newPile = {
        Name: 'DeckCustom',
        ContainedObjects: [{ CardID: newCardID, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }],
        DeckIDs: [newCardID],
        CustomDeck: { [customDeckKey]: { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true } },
        Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
      };
      deckObj.ObjectStates.splice(pileIndex + 1, 0, newPile);
    }

    return { cardID: newCardID, slot: newSlot };
  };

  const moveCardBetweenPiles = (deckObj, origPileIndex, newPileIndex, cardId, name, frontUrl, backUrl) => {
    const origPile = deckObj.ObjectStates[origPileIndex];
    if (origPile && Array.isArray(origPile.ContainedObjects)) {
      const remIdx = origPile.ContainedObjects.findIndex(c => c.CardID === cardId);
      if (remIdx !== -1) origPile.ContainedObjects.splice(remIdx, 1);
      if (Array.isArray(origPile.DeckIDs)) {
        const dIdx = origPile.DeckIDs.findIndex(d => d === cardId);
        if (dIdx !== -1) origPile.DeckIDs.splice(dIdx, 1);
      }
    }

    const newPile = deckObj.ObjectStates[newPileIndex];
    if (newPile && Array.isArray(newPile.ContainedObjects)) {
      newPile.ContainedObjects.unshift({ CardID: cardId, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } });
      if (!Array.isArray(newPile.DeckIDs)) newPile.DeckIDs = [];
      newPile.DeckIDs.unshift(cardId);
      const customKey = String(Math.floor(cardId / 100));
      ensureCustomDeckEntry(newPile, customKey, frontUrl, backUrl);
    }
  };

  const updateCardInPlace = (deckObj, origPileIndex, cardId, name, frontUrl, backUrl) => {
    const origPile = deckObj.ObjectStates[origPileIndex];
    if (!origPile) return;
    if (Array.isArray(origPile.ContainedObjects)) {
      const objIndex = origPile.ContainedObjects.findIndex(c => c.CardID === cardId);
      if (objIndex !== -1) origPile.ContainedObjects[objIndex].Nickname = name;
    } else if (origPile.Name === 'Card' && origPile.CardID === cardId) {
      origPile.Nickname = name;
    }

    const slot = Math.floor(cardId / 100);
    if (origPile.CustomDeck && origPile.CustomDeck[slot]) {
      origPile.CustomDeck[slot].FaceURL = frontUrl;
      origPile.CustomDeck[slot].BackURL = backUrl && backUrl.length ? backUrl : DEFAULT_BACK;
    }
  };

  const removeCardFromPile = (deckObj, pileIndex, cardId) => {
    const targetPile = deckObj.ObjectStates[pileIndex];
    if (!targetPile) return;
    if (Array.isArray(targetPile.ContainedObjects)) {
      const remIdx = targetPile.ContainedObjects.findIndex(c => c.CardID === cardId);
      if (remIdx !== -1) targetPile.ContainedObjects.splice(remIdx, 1);
    } else if (targetPile.Name === 'Card' && targetPile.CardID === cardId) {
      deckObj.ObjectStates.splice(pileIndex, 1);
      return;
    }

    if (Array.isArray(targetPile.DeckIDs)) {
      const dIdx = targetPile.DeckIDs.findIndex(d => d === cardId);
      if (dIdx !== -1) targetPile.DeckIDs.splice(dIdx, 1);
    }

    const slot = Math.floor(cardId / 100);
    if (targetPile && targetPile.CustomDeck && targetPile.CustomDeck[slot]) {
      const stillUses = (targetPile.DeckIDs || []).some(d => Math.floor(d / 100) === slot);
      if (!stillUses) delete targetPile.CustomDeck[slot];
    }
  };

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
        const res = await axios.post('/magic-json', { url: deckUrl });
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
    const { name, frontUrl, backUrl, pileId } = addForm;
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
        setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: '' });
        return;
      }

      // Add new card
      const pileIndex = parseInt(pileId.split('-')[1], 10);
      addCardToPile(deckObj, pileIndex, name, frontUrl, backUrl);
      const updatedJson = JSON.stringify(deckObj);
      setDeckJson(updatedJson);
      const processed = processDeckData(deckObj);
      setProcessedDeck(processed);
      const pileTitle = processed.find(p => p.id === pileId)?.title || pileId;
      setSuccessMessage(`Added "${name}" to ${pileTitle}`);
      setErrorMessage(null);
      setShowAddForm(false);
      setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: '' });
    } catch (err) {
      console.error('Error modifying deck', err);
      setErrorMessage('Failed to modify deck');
    }
  }
  function processDeckData(rawDeck) {
    try {
      const deck = typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck;
      if (!deck.ObjectStates || !Array.isArray(deck.ObjectStates)) {
        console.warn('processDeckData: invalid deck structure');
        return [];
      }

      const defaultBack = "https://i.imgur.com/Hg8CwwU.jpeg";
      const piles = [];

      deck.ObjectStates.forEach((pile, pileIdx) => {
        if (!pile) return;

        const pileCards = [];

        // If pile has ContainedObjects (DeckCustom)
        if (Array.isArray(pile.ContainedObjects)) {
          pile.ContainedObjects.forEach((card, idx) => {
            try {
              const slot = Math.floor(card.CardID / 100);
              const cardData = pile.CustomDeck && pile.CustomDeck[slot];
              if (!cardData) return;

              const frontLarge = cardData.FaceURL;
              const frontSmall = frontLarge ? frontLarge.replace('large', 'small') : null;
              const backLarge = cardData.BackURL && cardData.BackURL !== defaultBack ? cardData.BackURL : null;
              const backSmall = backLarge ? backLarge.replace('large', 'small') : null;

              pileCards.push({
                id: `${card.CardID}-${pileIdx}-${idx}`,
                cardID: card.CardID,
                nickname: card.Nickname,
                frontSmall,
                frontLarge,
                backSmall,
                backLarge
              });
            } catch (err) {
              console.warn('processDeckData: skipping card', card, err);
            }
          });
        } else if (pile.Name === 'Card' && pile.CardID) {
          // Single card pile (e.g., commander represented as a Card object)
          try {
            const card = pile;
            const slot = Math.floor(card.CardID / 100);
            const cardData = pile.CustomDeck && pile.CustomDeck[slot];
            if (cardData) {
              const frontLarge = cardData.FaceURL;
              const frontSmall = frontLarge ? frontLarge.replace('large', 'small') : null;
              const backLarge = cardData.BackURL && cardData.BackURL !== defaultBack ? cardData.BackURL : null;
              const backSmall = backLarge ? backLarge.replace('large', 'small') : null;

              pileCards.push({
                id: `${card.CardID}-${pileIdx}-0`,
                cardID: card.CardID,
                nickname: card.Nickname,
                frontSmall,
                frontLarge,
                backSmall,
                backLarge
              });
            }
          } catch (err) {
            console.warn('processDeckData: skipping single-card pile', pile, err);
          }
        }

        if (pileCards.length > 0) {
          const title = `Pile ${pileIdx + 1}`;
          piles.push({ id: `pile-${pileIdx}`, title, cards: pileCards });
        }
      });

      return piles;
    } catch (err) {
      console.error('processDeckData error', err);
      return [];
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
                <button className="btn btn-secondary" onClick={() => {
                  setShowAddForm(s => !s);
                  setInfoMessage(null);
                  setErrorMessage(null);
                  // default pile selection to first available pile
                  if (processedDeck.length && !addForm.pileId) {
                    setAddForm(prev => ({ ...prev, pileId: processedDeck[0].id }));
                  }
                }}>Add Card</button>
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
              <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Close</button>
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
              </div>
              <div className="mb-2">
                <label className="form-label">Pile</label>
                <select className="form-select" value={addForm.pileId} onChange={e => handleAddFormChange('pileId', e.target.value)}>
                  <option value="">Select pile</option>
                  {processedDeck.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="d-grid">
                <button type="submit" className="btn btn-primary">{editingCard ? 'Save Changes' : 'Add Card'}</button>
                {editingCard && <button type="button" className="btn btn-secondary mt-2" onClick={() => { setEditingCard(null); setAddForm({ name: '', frontUrl: '', backUrl: '', pileId: '' }); setShowAddForm(false); }}>Cancel</button>}
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