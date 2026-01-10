// Helpers for updating Tabletop Simulator deck JSON structures
const DEFAULT_BACK = 'https://i.imgur.com/Hg8CwwU.jpeg';

export function processDeckData(rawDeck) {
  try {
    const deck = typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck;
    if (!deck.ObjectStates || !Array.isArray(deck.ObjectStates)) {
      console.warn('processDeckData: invalid deck structure');
      return [];
    }

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
            const backLarge = cardData.BackURL && cardData.BackURL !== DEFAULT_BACK ? cardData.BackURL : null;
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
            const backLarge = cardData.BackURL && cardData.BackURL !== DEFAULT_BACK ? cardData.BackURL : null;
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
        const title = pile.Nickname && pile.Nickname.length ? pile.Nickname : `Pile ${pileIdx + 1}`;
        piles.push({ id: `pile-${pileIdx}`, title, cards: pileCards });
      }
    });

    return piles;
  } catch (err) {
    console.error('processDeckData error', err);
    return [];
  }
}

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

export function addCardToPile(deckObj, pileIndex, name, frontUrl, backUrl, quantity = 1) {
  const allDeckIDs = deckObj.ObjectStates.flatMap(p => p.DeckIDs || []);
  const maxDeckID = allDeckIDs.length ? Math.max(...allDeckIDs) : 0;
  const baseSlot = Math.floor(maxDeckID / 100) + 1;
  const baseCardID = baseSlot * 100;
  const cardIDs = Array.from({ length: Math.max(1, quantity) }, (_, i) => baseCardID + i);
  const targetPile = deckObj.ObjectStates[pileIndex];

  // Special-case: Mainboard with a custom back -> add quantity copies to Mainboard (default back)
  // and a single double-sided card to the "Double-sided Cards" pile.
  if (targetPile && targetPile.Nickname === 'Mainboard' && backUrl && backUrl.length && backUrl !== DEFAULT_BACK) {
    // Insert copies into Mainboard
    if (Array.isArray(targetPile.ContainedObjects)) {
      const newContained = cardIDs.map(cid => ({ CardID: cid, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }));
      targetPile.ContainedObjects = [...newContained, ...targetPile.ContainedObjects];
      if (!Array.isArray(targetPile.DeckIDs)) targetPile.DeckIDs = [];
      targetPile.DeckIDs = [...cardIDs, ...targetPile.DeckIDs];
      ensureCustomDeckEntry(targetPile, baseSlot, frontUrl, DEFAULT_BACK);
    } else if (targetPile && targetPile.Name === 'Card') {
      const existingCardID = targetPile.CardID;
      const existingNickname = targetPile.Nickname;
      const existingCustomDeck = targetPile.CustomDeck || {};
      const customDeck = {};
      Object.keys(existingCustomDeck).forEach(k => { customDeck[k] = existingCustomDeck[k]; });
      customDeck[String(baseSlot)] = { FaceURL: frontUrl, BackURL: DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true };

      const containedObjects = [
        { CardID: existingCardID, Name: 'Card', Nickname: existingNickname, Transform: targetPile.Transform },
        ...cardIDs.map(cid => ({ CardID: cid, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }))
      ];

      const newPile = {
        Name: 'DeckCustom',
        Nickname: targetPile.Nickname || '',
        ContainedObjects: containedObjects,
        DeckIDs: containedObjects.map(c => c.CardID),
        CustomDeck: customDeck,
        Transform: targetPile.Transform || { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
      };
      deckObj.ObjectStates.splice(pileIndex, 1, newPile);
    } else {
      const newPile = {
        Name: 'DeckCustom',
        Nickname: 'Mainboard',
        ContainedObjects: cardIDs.map(cid => ({ CardID: cid, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } })),
        DeckIDs: [...cardIDs],
        CustomDeck: { [String(baseSlot)]: { FaceURL: frontUrl, BackURL: DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true } },
        Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
      };
      deckObj.ObjectStates.splice(pileIndex + 1, 0, newPile);
    }

    // Add single double-sided card to "Double-sided Cards"
    const { newCardID: newCardID2, newSlot: newSlot2 } = computeNewCardId(deckObj);
    let doubleIdx = deckObj.ObjectStates.findIndex(p => p && p.Nickname === 'Double-sided Cards');
    if (doubleIdx === -1) {
      const created = {
        Name: 'DeckCustom',
        Nickname: 'Double-sided Cards',
        ContainedObjects: [{ CardID: newCardID2, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }],
        DeckIDs: [newCardID2],
        CustomDeck: { [String(newSlot2)]: { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true } },
        Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
      };
      deckObj.ObjectStates.push(created);
    } else {
      const doublePile = deckObj.ObjectStates[doubleIdx];
      if (Array.isArray(doublePile.ContainedObjects)) {
        doublePile.ContainedObjects.unshift({ CardID: newCardID2, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } });
        if (!Array.isArray(doublePile.DeckIDs)) doublePile.DeckIDs = [];
        doublePile.DeckIDs.unshift(newCardID2);
        ensureCustomDeckEntry(doublePile, newSlot2, frontUrl, backUrl);
      } else if (doublePile.Name === 'Card') {
        const existingCardID = doublePile.CardID;
        const existingNickname = doublePile.Nickname;
        const existingCustomDeck = doublePile.CustomDeck || {};
        const customDeck = {};
        Object.keys(existingCustomDeck).forEach(k => { customDeck[k] = existingCustomDeck[k]; });
        customDeck[String(newSlot2)] = { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true };
        const containedObjects = [
          { CardID: existingCardID, Name: 'Card', Nickname: existingNickname, Transform: doublePile.Transform },
          { CardID: newCardID2, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }
        ];
        const replaced = {
          Name: 'DeckCustom',
          Nickname: doublePile.Nickname || '',
          ContainedObjects: containedObjects,
          DeckIDs: containedObjects.map(c => c.CardID),
          CustomDeck: customDeck,
          Transform: doublePile.Transform || { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
        };
        deckObj.ObjectStates.splice(doubleIdx, 1, replaced);
      } else {
        const created = {
          Name: 'DeckCustom',
          Nickname: 'Double-sided Cards',
          ContainedObjects: [{ CardID: newCardID2, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }],
          DeckIDs: [newCardID2],
          CustomDeck: { [String(newSlot2)]: { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true } },
          Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
        };
        deckObj.ObjectStates.push(created);
      }
    }

    return { cardID: cardIDs[0], slot: baseSlot };
  }

  // Non-Mainboard or default-back flow
  if (targetPile && Array.isArray(targetPile.ContainedObjects)) {
    const newContained = cardIDs.map(cid => ({ CardID: cid, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }));
    targetPile.ContainedObjects = [...newContained, ...targetPile.ContainedObjects];
    if (!Array.isArray(targetPile.DeckIDs)) targetPile.DeckIDs = [];
    targetPile.DeckIDs = [...cardIDs, ...targetPile.DeckIDs];
    ensureCustomDeckEntry(targetPile, baseSlot, frontUrl, backUrl);
    return { cardID: cardIDs[0], slot: baseSlot };
  }

  if (targetPile && targetPile.Name === 'Card') {
    const existingCardID = targetPile.CardID;
    const existingNickname = targetPile.Nickname;
    const existingCustomDeck = targetPile.CustomDeck || {};

    const customDeck = {};
    Object.keys(existingCustomDeck).forEach(k => { customDeck[k] = existingCustomDeck[k]; });
    customDeck[String(baseSlot)] = { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true };

    const containedObjects = [
      { CardID: existingCardID, Name: 'Card', Nickname: existingNickname, Transform: targetPile.Transform },
      ...cardIDs.map(cid => ({ CardID: cid, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } }))
    ];

    const newPile = {
      Name: 'DeckCustom',
      Nickname: targetPile.Nickname || '',
      ContainedObjects: containedObjects,
      DeckIDs: containedObjects.map(c => c.CardID),
      CustomDeck: customDeck,
      Transform: targetPile.Transform || { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
    };

    deckObj.ObjectStates.splice(pileIndex, 1, newPile);
    return { cardID: cardIDs[0], slot: baseSlot };
  }

  const newPile = {
    Name: 'DeckCustom',
    Nickname: '',
    ContainedObjects: cardIDs.map(cid => ({ CardID: cid, Name: 'Card', Nickname: name, Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 } })),
    DeckIDs: [...cardIDs],
    CustomDeck: { [String(baseSlot)]: { FaceURL: frontUrl, BackURL: backUrl && backUrl.length ? backUrl : DEFAULT_BACK, NumHeight: 1, NumWidth: 1, BackIsHidden: true } },
    Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 }
  };
  deckObj.ObjectStates.splice(pileIndex + 1, 0, newPile);
  return { cardID: cardIDs[0], slot: baseSlot };
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
