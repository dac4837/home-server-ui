// Helpers for updating Tabletop Simulator deck JSON structures
const DEFAULT_BACK = 'https://i.imgur.com/Hg8CwwU.jpeg';

export function computeNewCardId(deckObj) {
  const allDeckIDs = deckObj.ObjectStates.flatMap(p => p.DeckIDs || []);
  const maxDeckID = allDeckIDs.length ? Math.max(...allDeckIDs) : 0;
  const newSlot = Math.floor(maxDeckID / 100) + 1;
  const newCardID = newSlot * 100;
  return { newCardID, newSlot };
}

function ensureCustomDeckEntry(pile, slot, face, back) {
  if (!pile.CustomDeck) pile.CustomDeck = {};
  pile.CustomDeck[String(slot)] = { FaceURL: face, BackURL: back && back.length ? back : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true };
}

export function addCardToPile(deckObj, pileIndex, name, frontUrl, backUrl) {
  const { newCardID, newSlot } = computeNewCardId(deckObj);
  const targetPile = deckObj.ObjectStates[pileIndex];

  // If pile is DeckCustom (has ContainedObjects), append the new card
  if (targetPile && Array.isArray(targetPile.ContainedObjects)) {
    const newContained = { CardID: newCardID, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } };
    targetPile.ContainedObjects.unshift(newContained);
    if (!Array.isArray(targetPile.DeckIDs)) targetPile.DeckIDs = [];
    targetPile.DeckIDs.unshift(newCardID);
    ensureCustomDeckEntry(targetPile, newSlot, frontUrl, backUrl);
    return { cardID: newCardID, slot: newSlot };
  }

  // If pile is a single Card object, convert it to a DeckCustom that contains both the existing and new card
  if (targetPile && targetPile.Name === 'Card') {
    const existingCardID = targetPile.CardID;
    const existingNickname = targetPile.Nickname;
    const existingCustomDeck = targetPile.CustomDeck || {};

    const customDeck = {};
    // copy existingCustomDeck entries
    Object.keys(existingCustomDeck).forEach(k => { customDeck[k] = existingCustomDeck[k]; });

    // ensure new slot mapping
    customDeck[String(newSlot)] = { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true };

    const containedObjects = [
      { CardID: existingCardID, Name: 'Card', Nickname: existingNickname, Transform: targetPile.Transform },
      { CardID: newCardID, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }
    ];

    const newPile = {
      Name: 'DeckCustom',
      Nickname: targetPile.Nickname || '',
      ContainedObjects: containedObjects,
      DeckIDs: containedObjects.map(c => c.CardID),
      CustomDeck: customDeck,
      Transform: targetPile.Transform || { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
    };

    // replace the single card pile with the new DeckCustom
    deckObj.ObjectStates.splice(pileIndex, 1, newPile);
    return { cardID: newCardID, slot: newSlot };
  }

  // If pile not found or unknown type, append a new DeckCustom after pileIndex
  const newPile = {
    Name: 'DeckCustom',
    Nickname: '',
    ContainedObjects: [{ CardID: newCardID, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }],
    DeckIDs: [newCardID],
    CustomDeck: { [String(newSlot)]: { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true } },
    Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
  };
  deckObj.ObjectStates.splice(pileIndex + 1, 0, newPile);
  return { cardID: newCardID, slot: newSlot };
}

export function moveCardBetweenPiles(deckObj, origPileIndex, newPileIndex, cardId, name, frontUrl, backUrl) {
  // remove from original pile
  const origPile = deckObj.ObjectStates[origPileIndex];
  if (origPile) {
    if (Array.isArray(origPile.ContainedObjects)) {
      const remIdx = origPile.ContainedObjects.findIndex(c => c.CardID === cardId);
      if (remIdx !== -1) origPile.ContainedObjects.splice(remIdx, 1);
      if (Array.isArray(origPile.DeckIDs)) {
        const dIdx = origPile.DeckIDs.findIndex(d => d === cardId);
        if (dIdx !== -1) origPile.DeckIDs.splice(dIdx, 1);
      }
    } else if (origPile.Name === 'Card' && origPile.CardID === cardId) {
      // remove the single-card pile entirely
      deckObj.ObjectStates.splice(origPileIndex, 1);
    }
  }

  // add to new pile, converting single-card -> DeckCustom if needed
  const newPile = deckObj.ObjectStates[newPileIndex];
  if (newPile && Array.isArray(newPile.ContainedObjects)) {
    newPile.ContainedObjects.unshift({ CardID: cardId, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } });
    if (!Array.isArray(newPile.DeckIDs)) newPile.DeckIDs = [];
    newPile.DeckIDs.unshift(cardId);
    const customKey = String(Math.floor(cardId / 100));
    ensureCustomDeckEntry(newPile, customKey, frontUrl, backUrl);
    return;
  }

  if (newPile && newPile.Name === 'Card') {
    // convert single card to DeckCustom containing both
    const existingCardID = newPile.CardID;
    const existingNickname = newPile.Nickname;
    const existingCustomDeck = newPile.CustomDeck || {};
    const customDeck = {};
    Object.keys(existingCustomDeck).forEach(k => { customDeck[k] = existingCustomDeck[k]; });
    const newSlot = Math.floor(cardId / 100);
    customDeck[String(newSlot)] = { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true };

    const containedObjects = [
      { CardID: existingCardID, Name: 'Card', Nickname: existingNickname, Transform: newPile.Transform },
      { CardID: cardId, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }
    ];

    const replaced = {
      Name: 'DeckCustom',
      Nickname: newPile.Nickname || '',
      ContainedObjects: containedObjects,
      DeckIDs: containedObjects.map(c => c.CardID),
      CustomDeck: customDeck,
      Transform: newPile.Transform || { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
    };

    deckObj.ObjectStates.splice(newPileIndex, 1, replaced);
    return;
  }

  // otherwise insert a DeckCustom containing moved card
  const created = {
    Name: 'DeckCustom',
    Nickname: '',
    ContainedObjects: [{ CardID: cardId, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }],
    DeckIDs: [cardId],
    CustomDeck: { [String(Math.floor(cardId / 100))]: { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true } },
    Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
  };
  deckObj.ObjectStates.splice(newPileIndex + 1, 0, created);
}

export function updateCardInPlace(deckObj, origPileIndex, cardId, name, frontUrl, backUrl) {
  const origPile = deckObj.ObjectStates[origPileIndex];
  if (!origPile) return;
  if (Array.isArray(origPile.ContainedObjects)) {
    const objIndex = origPile.ContainedObjects.findIndex(c => c.CardID === cardId);
    if (objIndex !== -1) origPile.ContainedObjects[objIndex].Nickname = name;
  } else if (origPile.Name === 'Card' && origPile.CardID === cardId) {
    origPile.Nickname = name;
  }

  const slot = Math.floor(cardId / 100);
  if (!origPile.CustomDeck) origPile.CustomDeck = {};
  if (!origPile.CustomDeck[slot]) origPile.CustomDeck[slot] = { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true };
  else {
    origPile.CustomDeck[slot].FaceURL = frontUrl;
    origPile.CustomDeck[slot].BackURL = backUrl && backUrl.length ? backUrl : DEFAULT_BACK;
  }
}

export function removeCardFromPile(deckObj, pileIndex, cardId) {
  const targetPile = deckObj.ObjectStates[pileIndex];
  if (!targetPile) return;
  if (Array.isArray(targetPile.ContainedObjects)) {
    const remIdx = targetPile.ContainedObjects.findIndex(c => c.CardID === cardId);
    if (remIdx !== -1) targetPile.ContainedObjects.splice(remIdx, 1);
    // if after removal only one card remains, convert to single Card object
    if (targetPile.ContainedObjects.length === 1) {
      const remaining = targetPile.ContainedObjects[0];
      const slot = Math.floor(remaining.CardID / 100);
      const customDeck = (targetPile.CustomDeck && targetPile.CustomDeck[slot]) ? { [String(slot)]: targetPile.CustomDeck[slot] } : {};
      const single = {
        Name: 'Card',
        CustomDeck: customDeck,
        CardID: remaining.CardID,
        Nickname: remaining.Nickname,
        Transform: targetPile.Transform
      };
      deckObj.ObjectStates.splice(pileIndex, 1, single);
      return;
    }
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
}

// Named exports are provided above; no default export to satisfy lint rules
