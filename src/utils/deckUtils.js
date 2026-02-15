const DEFAULT_BACK = 'https://i.imgur.com/Hg8CwwU.jpeg';
const DEFAULT_TRANSFORM = { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 };
const CUSTOM_DECK_PROPERTIES = { NumHeight: 1, NumWidth: 1, BackIsHidden: true };

// Helper: Create a contained object entry for a card
function createContainedObjectsEntry(cardID, nickname, transform = DEFAULT_TRANSFORM) {
  return {
    CardID: cardID,
    Name: "Card",
    Nickname: nickname,
    Transform: transform
  };
}

// Helper: Create a custom deck entry
function createCustomDeckEntry(faceURL, backURL = DEFAULT_BACK) {
  return {
    FaceURL: faceURL,
    BackURL: backURL,
    ...CUSTOM_DECK_PROPERTIES
  };
}

// Helper: Normalize back URL (return null if it's the default back)
function normalizeBackUrl(backUrl) {
  return (backUrl && backUrl.length && backUrl !== DEFAULT_BACK) ? backUrl : null;
}

// Helper: Create a DeckCustom pile structure
function createDeckCustomPile(nickname, description, containedObjects, customDeck, transform = DEFAULT_TRANSFORM) {
  return {
    Name: 'DeckCustom',
    Nickname: nickname,
    Description: description,
    ContainedObjects: containedObjects,
    DeckIDs: containedObjects.map(c => c.CardID),
    CustomDeck: customDeck,
    Transform: transform
  };
}

// Helper: Convert a single Card pile to DeckCustom containing both cards
function convertSingleCardToDeckCustom(existingPile, newCardID, newCardName, newCardFrontUrl, newCardBackUrl) {
  const existingCardID = existingPile.CardID;
  const existingNickname = existingPile.Nickname;
  const existingCustomDeck = existingPile.CustomDeck || {};
  const customDeck = { ...existingCustomDeck };
  
  // Find the next available slot for the new card
  let newSlot = Math.floor(newCardID / 100);
  while (customDeck[String(newSlot)]) {
    newSlot++;
  }
  
  // Ensure the new CardID matches the slot assignment to maintain CardID/100 = slot relationship
  // This is critical so processDeckData can correctly map CardID to CustomDeck slots
  const actualNewCardID = newSlot * 100;
  
  customDeck[String(newSlot)] = {
    ...createCustomDeckEntry(newCardFrontUrl, normalizeBackUrl(newCardBackUrl) || DEFAULT_BACK)
  };

  const containedObjects = [
    createContainedObjectsEntry(existingCardID, existingNickname, existingPile.Transform),
    createContainedObjectsEntry(actualNewCardID, newCardName, DEFAULT_TRANSFORM)
  ];

  return createDeckCustomPile(
    existingPile.Nickname || '',
    existingPile.Description || existingPile.Nickname || '',
    containedObjects,
    customDeck,
    existingPile.Transform || DEFAULT_TRANSFORM
  );
}

export function processDeckData(rawDeck) {
  try {
    const deck = typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck;
    if (!deck.ObjectStates || !Array.isArray(deck.ObjectStates)) {
      console.warn('processDeckData: invalid deck structure');
      return [];
    }

    // Fixed pile buckets
    const buckets = {
      mainboard: { id: 'pile-mainboard', title: 'Mainboard', cards: [] },
      commander: { id: 'pile-commander', title: 'Commander', cards: [] },
      tokens: { id: 'pile-tokens', title: 'Tokens', cards: [] },
      double: { id: 'pile-double', title: 'Double-sided Cards', cards: [] }
    };

    // helper to push card into a bucket
    function pushCard(bucketKey, cardObj, pileIdx, idx) {
      const entry = {
        id: `${cardObj.CardID}-${pileIdx}-${idx}`,
        cardID: cardObj.CardID,
        nickname: cardObj.Nickname,
        frontSmall: null,
        frontLarge: null,
        backSmall: null,
        backLarge: null
      };
      const slot = Math.floor(cardObj.CardID / 100);
      const cardData = (cardObj.__customDeckOwner && cardObj.__customDeckOwner.CustomDeck && cardObj.__customDeckOwner.CustomDeck[slot]) || null;
      if (cardData) {
        const frontLarge = cardData.FaceURL;
        const frontSmall = frontLarge ? frontLarge.replace('large', 'small') : null;
        const backLarge = cardData.BackURL && cardData.BackURL !== DEFAULT_BACK ? cardData.BackURL : null;
        const backSmall = backLarge ? backLarge.replace('large', 'small') : null;
        entry.frontLarge = frontLarge;
        entry.frontSmall = frontSmall;
        entry.backLarge = backLarge;
        entry.backSmall = backSmall;
      }
      buckets[bucketKey].cards.push(entry);
    }

    deck.ObjectStates.forEach((pile, pileIdx) => {
      if (!pile) return;

      // Determine bucket by Description/Nickname heuristics
      const title = (pile.Description || pile.Nickname || '').toLowerCase();
      let bucket = 'mainboard';
      if (title.includes('commander')) bucket = 'commander';
      else if (title.includes('token')) bucket = 'tokens';
      else if (title.includes('double')) bucket = 'double';

      // If pile has ContainedObjects (DeckCustom)
      if (Array.isArray(pile.ContainedObjects)) {
        pile.ContainedObjects.forEach((card, idx) => {
          // attach a back-reference so we can find CustomDeck entries
          card.__customDeckOwner = pile;
          try {
            pushCard(bucket, card, pileIdx, idx);
          } catch (err) {
            console.warn('processDeckData: skipping card', card, err);
          }
        });
      } else if (pile.Name === 'Card' && pile.CardID) {
        const card = pile;
        card.__customDeckOwner = pile;
        try {
          pushCard(bucket, card, pileIdx, 0);
        } catch (err) {
          console.warn('processDeckData: skipping single-card pile', pile, err);
        }
      }
    });

    // Return piles only if they have cards, in desired order
    const order = ['mainboard', 'commander', 'tokens', 'double'];
    return order.map(k => buckets[k]).filter(b => b.cards && b.cards.length > 0);
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
  pile.CustomDeck[String(slot)] = {
    ...createCustomDeckEntry(face, normalizeBackUrl(back) || DEFAULT_BACK)
  };
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
  if (targetPile && ((targetPile.Description === 'Mainboard') || (targetPile.Nickname === 'Mainboard')) && normalizeBackUrl(backUrl)) {
    // Insert copies into Mainboard
    if (Array.isArray(targetPile.ContainedObjects)) {
      const newContained = cardIDs.map(cid => createContainedObjectsEntry(cid, name));
      targetPile.ContainedObjects = [...newContained, ...targetPile.ContainedObjects];
      if (!Array.isArray(targetPile.DeckIDs)) targetPile.DeckIDs = [];
      targetPile.DeckIDs = [...cardIDs, ...targetPile.DeckIDs];
      ensureCustomDeckEntry(targetPile, baseSlot, frontUrl, DEFAULT_BACK);
    } else if (targetPile && targetPile.Name === 'Card') {
      const customDeck = { ...targetPile.CustomDeck || {} };
      customDeck[String(baseSlot)] = {
        ...createCustomDeckEntry(frontUrl, DEFAULT_BACK)
      };

      const containedObjects = [
        createContainedObjectsEntry(targetPile.CardID, targetPile.Nickname, targetPile.Transform),
        ...cardIDs.map(cid => createContainedObjectsEntry(cid, name))
      ];

      const newPile = createDeckCustomPile(
        targetPile.Nickname || '',
        targetPile.Description || targetPile.Nickname || '',
        containedObjects,
        customDeck,
        targetPile.Transform || DEFAULT_TRANSFORM
      );
      deckObj.ObjectStates.splice(pileIndex, 1, newPile);
    } else {
      const newPile = createDeckCustomPile(
        'Mainboard',
        'Mainboard',
        cardIDs.map(cid => createContainedObjectsEntry(cid, name)),
        { [String(baseSlot)]: { ...createCustomDeckEntry(frontUrl, DEFAULT_BACK) } },
        DEFAULT_TRANSFORM
      );
      deckObj.ObjectStates.splice(pileIndex + 1, 0, newPile);
    }

    // Add single double-sided card to "Double-sided Cards"
    const { newCardID: newCardID2, newSlot: newSlot2 } = computeNewCardId(deckObj);
    let doubleIdx = deckObj.ObjectStates.findIndex(p => p && ((p.Description === 'Double-sided Cards') || (p.Nickname === 'Double-sided Cards')));
    if (doubleIdx === -1) {
      const created = createDeckCustomPile(
        'Double-sided Cards',
        'Double-sided Cards',
        [createContainedObjectsEntry(newCardID2, name)],
        { [String(newSlot2)]: { ...createCustomDeckEntry(frontUrl, backUrl || DEFAULT_BACK) } },
        DEFAULT_TRANSFORM
      );
      deckObj.ObjectStates.push(created);
    } else {
      const doublePile = deckObj.ObjectStates[doubleIdx];
      if (Array.isArray(doublePile.ContainedObjects)) {
        doublePile.ContainedObjects.unshift(createContainedObjectsEntry(newCardID2, name));
        if (!Array.isArray(doublePile.DeckIDs)) doublePile.DeckIDs = [];
        doublePile.DeckIDs.unshift(newCardID2);
        ensureCustomDeckEntry(doublePile, newSlot2, frontUrl, backUrl);
      } else if (doublePile.Name === 'Card') {
        const replaced = convertSingleCardToDeckCustom(doublePile, newCardID2, name, frontUrl, backUrl);
        deckObj.ObjectStates.splice(doubleIdx, 1, replaced);
      } else {
        const created = createDeckCustomPile(
          'Double-sided Cards',
          'Double-sided Cards',
          [createContainedObjectsEntry(newCardID2, name)],
          { [String(newSlot2)]: { ...createCustomDeckEntry(frontUrl, backUrl || DEFAULT_BACK) } },
          DEFAULT_TRANSFORM
        );
        deckObj.ObjectStates.push(created);
      }
    }

    return { cardID: cardIDs[0], slot: baseSlot };
  }

  // Non-Mainboard or default-back flow
  if (targetPile && Array.isArray(targetPile.ContainedObjects)) {
    const newContained = cardIDs.map(cid => createContainedObjectsEntry(cid, name));
    targetPile.ContainedObjects = [...newContained, ...targetPile.ContainedObjects];
    if (!Array.isArray(targetPile.DeckIDs)) targetPile.DeckIDs = [];
    targetPile.DeckIDs = [...cardIDs, ...targetPile.DeckIDs];
    ensureCustomDeckEntry(targetPile, baseSlot, frontUrl, backUrl);
    return { cardID: cardIDs[0], slot: baseSlot };
  }

  if (targetPile && targetPile.Name === 'Card') {
    const customDeck = { ...targetPile.CustomDeck || {} };
    customDeck[String(baseSlot)] = {
      ...createCustomDeckEntry(frontUrl, backUrl || DEFAULT_BACK)
    };

    const containedObjects = [
      createContainedObjectsEntry(targetPile.CardID, targetPile.Nickname, targetPile.Transform),
      ...cardIDs.map(cid => createContainedObjectsEntry(cid, name))
    ];

    const newPile = createDeckCustomPile(
      targetPile.Nickname || '',
      targetPile.Description || targetPile.Nickname || '',
      containedObjects,
      customDeck,
      targetPile.Transform || DEFAULT_TRANSFORM
    );

    deckObj.ObjectStates.splice(pileIndex, 1, newPile);
    return { cardID: cardIDs[0], slot: baseSlot };
  }

  const newPile = createDeckCustomPile(
    '',
    '',
    cardIDs.map(cid => createContainedObjectsEntry(cid, name)),
    { [String(baseSlot)]: { ...createCustomDeckEntry(frontUrl, backUrl || DEFAULT_BACK) } },
    DEFAULT_TRANSFORM
  );
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
    newPile.ContainedObjects.unshift(createContainedObjectsEntry(cardId, name));
    if (!Array.isArray(newPile.DeckIDs)) newPile.DeckIDs = [];
    newPile.DeckIDs.unshift(cardId);
    const customKey = String(Math.floor(cardId / 100));
    ensureCustomDeckEntry(newPile, customKey, frontUrl, backUrl);
    return;
  }

  if (newPile && newPile.Name === 'Card') {
    // convert single card to DeckCustom containing both
    const replaced = convertSingleCardToDeckCustom(newPile, cardId, name, frontUrl, backUrl);
    deckObj.ObjectStates.splice(newPileIndex, 1, replaced);
    return;
  }

  // otherwise insert a DeckCustom containing moved card
  const created = createDeckCustomPile(
    '',
    '',
    [createContainedObjectsEntry(cardId, name)],
    { [String(Math.floor(cardId / 100))]: { ...createCustomDeckEntry(frontUrl, backUrl || DEFAULT_BACK) } },
    DEFAULT_TRANSFORM
  );
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
  const backUrlValue = normalizeBackUrl(backUrl) || DEFAULT_BACK;
  if (!origPile.CustomDeck[slot]) {
    origPile.CustomDeck[slot] = createCustomDeckEntry(frontUrl, backUrlValue);
  } else {
    origPile.CustomDeck[slot].FaceURL = frontUrl;
    origPile.CustomDeck[slot].BackURL = backUrlValue;
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
        Description: targetPile.Description || targetPile.Nickname || '',
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

/**
 * Convert card data (commanders, mainBoard, tokens) to TableTop Simulator deck JSON format.
 * This function constructs the complete TableTop-compatible object from card metadata.
 */
export function convertToTableTop(deckData) {
  const deck = {
    ObjectStates: []
  };

  let pileNumber = 0;

  const createContainedObjectsEntry = (card, id) => ({
    CardID: id,
    Name: "Card",
    Nickname: card.name,
    Transform: {
      posX: 0,
      posY: 0,
      posZ: 0,
      rotX: 0,
      rotY: 180,
      rotZ: 180,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1
    }
  });

  const createCustomDeckEntry = (card, id, useBack = false) => ({
    [id]: {
      FaceURL: card.front,
      BackURL: useBack ? card.back : DEFAULT_BACK,
      NumHeight: 1,
      NumWidth: 1,
      BackIsHidden: true
    }
  });

  const createTransform = (i, faceup) => {
    return {
      posX: i * 2.2,
      posY: 1,
      posZ: 0,
      rotX: 0,
      rotY: 180,
      rotZ: faceup ? 0 : 180,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1
    };
  };

  const createPile = (cards, pileNumber, pileName, options = { faceUp: false, useBack: false }) => {
    const customDeck = {};
    const containedObjects = [];

    let i = 1;

    for (const card of cards) {
      const cardCount = card.quantity || 1;

      for (let j = 0; j < cardCount; j++) {
        Object.assign(customDeck, createCustomDeckEntry(card, i, options.useBack));
        containedObjects.push(createContainedObjectsEntry(card, 100 * i));
        i++;
      }
    }

    const deckIDs = containedObjects.map(obj => obj.CardID);

    const transform = createTransform(pileNumber, options.faceUp);

    return {
      Name: "DeckCustom",
      Nickname: pileName,
      Description: pileName,
      ContainedObjects: containedObjects,
      DeckIDs: deckIDs,
      CustomDeck: customDeck,
      Transform: transform
    };
  };

  const createSingleCardPile = (card, pileNumber, pileName, options = { useBack: false }) => {
    const customDeck = createCustomDeckEntry(card, 1, options.useBack);

    return {
      Name: "Card",
      CustomDeck: customDeck,
      CardID: 100,
      Nickname: card.name,
      Description: pileName,
      Transform: createTransform(pileNumber, true)
    };
  };

  deck.ObjectStates.push(createPile(deckData.mainBoard, pileNumber++, "Mainboard"));

  // Commanders: `deckData.commanders` is an array (may be empty)
  if (deckData.commanders && Array.isArray(deckData.commanders) && deckData.commanders.length) {
    if (deckData.commanders.length === 1) {
      const useBack = deckData.commanders[0].back !== undefined;
      deck.ObjectStates.push(createSingleCardPile(deckData.commanders[0], pileNumber++, "Commander", { useBack }));
    } else {
      // Group multiple commanders into a single pile named "Commander"
      // If any commander has a back image, set useBack so backs are used where available
      const anyHasBack = deckData.commanders.some(c => c.back !== undefined);
      deck.ObjectStates.push(createPile(deckData.commanders, pileNumber++, "Commander", { faceUp: true, useBack: anyHasBack }));
    }
  }

  // Tokens: if only one token, use single card pipe, otherwise a pile
  if (deckData.tokens && Array.isArray(deckData.tokens) && deckData.tokens.length === 1) {
    deck.ObjectStates.push(createSingleCardPile(deckData.tokens[0], pileNumber++, "Tokens", { useBack: true }));
  } else {
    deck.ObjectStates.push(createPile(deckData.tokens || [], pileNumber++, "Tokens", { faceUp: true, useBack: true }));
  }

  return deck;
}