import { useState, useEffect, use } from "react";
const { JSDOM } = require('jsdom');
const axios = require('axios');
const fs = require('fs')


const deckUrl = "https://tappedout.net/mtg-decks/slime-time-gary-the-snail/"

const SLEEP_VALUE = 5000
const COOLDOWN_VALUE = 3000 * 60

let requestCount = 0

const headers = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:137.0) Gecko/20100101 Firefox/137.0",
};

export default function useDeckUtils() {

    const [deckUrl, setDeckUrl ] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [deckData, setDeckData] = useState()


    useEffect(async () => {

        await sleep(4000)
        setDeckData(deckUrl)

    }, [deckUrl])


    return [setDeckUrl, isLoading, deckData]


}



async function getDeckData(deckUrl) {

	console.log("trying " + SLEEP_VALUE / 1000 + " seconds")

	const deckRequest = await getPage(deckUrl)

	const document = getDocumentForHtml(deckRequest.data)
	// const document = getDocumentForHtml(htmlString)

	const mainBoard = await getMainBoardCards(document)

	const tokens = getTokens(document)

	const commander = await getCommander(document)


	return {
		commander,
		mainBoard,
		tokens
	}

	
}

function getDocumentForHtml(html) {
	const dom = new JSDOM(html);
	return dom.window.document;
}

async function getMainBoardCards(document) {
	const cardLINodes = document.querySelectorAll('li.member[id^="boardContainer-main"]');

	if (!cardLINodes || !cardLINodes.length) {
		throw new Error("Cannot find cards")
	}

	const cardLIs = [];
	cardLINodes.forEach(card =>
		cardLIs.push(card)
	);

	const results = [];

	for (const card of cardLIs) {
		const result = await createCardObject(card);

		results.push(result);
	}

	return results
}

async function createCardObject(card) {
	const cardAElement = card.querySelector('a[data-qty]');

	const cardSlug = cardAElement.getAttribute('data-slug')

	const name = cardAElement.getAttribute('data-name')

	const quantity = parseInt(cardAElement.getAttribute('data-qty'), 10)


	if (!cardAElement || !cardSlug || !name || !quantity) {
		throw new Error("invalid card data")
	}

	const cardUrl = `https://tappedout.net/mtg-card/${cardSlug}`

	const images = await getCardImages(cardUrl)


	return {
		name,
		quantity,
		...images
	};
}

async function getCardImages(cardUrl) {

	const { url, dom } = await getImageData(cardUrl)

	const cardBackUrl = getCardBackUrl(dom)

	let backImageUrl

	if (cardBackUrl) {
		const backData = await getImageData(cardBackUrl)
		backImageUrl = backData.url
	}

	return {
		front: url,
		back: backImageUrl
	}

}

async function getImageData(cardUrl) {
	const cardRequest = await getPage(cardUrl)

	const cardDom = getDocumentForHtml(cardRequest.data)

	const imageMeta = cardDom.querySelector('meta[property="og:image"]')

	const contentAttribute = imageMeta.getAttribute("content")

	const imageUrl = contentAttribute.includes("https://") ? contentAttribute : `https:${contentAttribute}`

	return {
		url: imageUrl,
		dom: cardDom
	}

}


function getCardBackUrl(document) {

	let url
	const headings = [...document.querySelectorAll("h4")];
	const backHeading = headings.find(h => h.textContent.trim() === "Back:" || h.textContent.trim() === "Front:");

	if (backHeading) {

		let next = backHeading?.nextElementSibling;
		let link = null;

		while (next && !link) {
			link = next.querySelector?.('a') || null;
			next = next.nextElementSibling;
		}

		if (link) {
			url = `https://tappedout.net/${link.getAttribute("data-url")}`
		}
	}

	return url
}

async function getCommander(document) {

	let commander
	const h3Elements = document.querySelectorAll("h3");

	let targetA = getCommanderAElement(h3Elements)

	if (targetA) {
		commander = await createCommanderObject(targetA)
	} else {
		console.log("No commander card found")
	}

	return commander

}

function getCommanderAElement(h3Elements) {
	let targetA = null;

	for (let h3 of h3Elements) {
		if (h3.textContent.includes("Commander")) {
			let next = h3.nextElementSibling;
			while (next && !targetA) {
				const aTag = next.querySelector("a");
				if (aTag) {
					targetA = aTag;
					break;
				}
				next = next.nextElementSibling;
			}
			break;
		}
	}

	return targetA
}

async function createCommanderObject(aElement) {
	const name = aElement.getAttribute('data-name')
	const cardRelativeUrl = aElement.getAttribute('data-url')

	if (!name || !cardRelativeUrl) {
		throw new Error("Error getting commander info")
	}
	const cardUrl = `https://tappedout.net${cardRelativeUrl}`

	const images = await getCardImages(cardUrl)

	return {
		name,
		...images
	}
}

function getTokens(document) {

	const tokens = []

	const deckDetails = document.querySelector("#deck-details")

	const tokenElements = deckDetails?.querySelectorAll(".card-token a")

	if (tokenElements) {
		tokenElements.forEach(token => {

			const imageUrl = token.getAttribute("data-image").includes("https://") ? token.getAttribute("data-image") : `https:${token.getAttribute("data-image")}`
			tokens.push({
				name: token.textContent?.replace(/[\r\n\t]+/g, ' '),
				front: `https:${imageUrl}`
			})
		})
	}

	return tokens

}

async function downloadDeckImages(deck) {

	const { commander, mainBoard, tokens } = deck
	const allCards = [commander, ...mainBoard, ...tokens]

	for (const card of allCards) {
		const { front, back } = card;

		await downloadImage(front);

		if (back) {
			await downloadImage(back);
		}
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPage(url) {

	console.log("getting " + url)

	const response = await getRequest(() => axios.get(url, {
		headers,
	}))

	return response
}

async function downloadImage(url) {
	const filename = url.split('/').pop();

	console.log("getting image " + filename + " from " + url)

	const writer = fs.createWriteStream(filename);

	const response = await axios({
			url,
			method: "GET",
			responseType: "stream",
			headers,
		})

	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on("finish", resolve);
		writer.on("error", reject);
	});
}

async function getRequest(request) {
	requestCount++

	if (requestCount > 51) {
		console.log("Sleeping for cooldown")
		await sleep(COOLDOWN_VALUE)
		requestCount = 0
	}

	let attempt = 0

	while (attempt < 5) {
		try {
			const response = await request()
			requestCount++
			await sleep(SLEEP_VALUE)
			return response
		} catch (e) {
			if (e.response?.status == 429) {
				console.log("Rate limited, sleeping")
			} else {
				console.log("error occured, sleeping")
				throw e
			}
			await sleep(COOLDOWN_VALUE)
			requestCount = 0
		}
		attempt++
	}

	throw new Error("Too many attempts getting data")
}


function convertToTableTop(deckData) {
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
			BackURL: useBack ? card.back : "https://i.imgur.com/Hg8CwwU.jpeg",
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
	}

	const createPile = (cards, pipeNumber, options = {faceUp: false, useBack: false}) => {

		const customDeck = {};
		const containedObjects = cards.map((card, i) => createContainedObjectsEntry(card, 100*(i+1)));
		const deckIDs = containedObjects.map(obj => obj.CardID);

		let i = 1;

		for (const card of cards) {
			Object.assign(customDeck, createCustomDeckEntry(card, i++, options.useBack));
		}

		const transform = createTransform(pipeNumber, options.faceUp);

		return {
			Name: "DeckCustom",
			ContainedObjects: containedObjects,
			DeckIDs: deckIDs,
			CustomDeck: customDeck,
			Transform: transform
		};
	}

	const createSingleCardPipe = (card, pipeNumber) => {
		const customDeck = createCustomDeckEntry(card, 1);

		return {
			Name: "Card",
			CustomDeck: customDeck,
			CardID: 100,
			Nickname: card.name,
			Transform: createTransform(pipeNumber, true)
		};
	}

	deck.ObjectStates.push(createPile(deckData.mainBoard, pileNumber++));
	deck.ObjectStates.push(createSingleCardPipe(deckData.commander, pileNumber++));
	deck.ObjectStates.push(createPile(deckData.tokens, pileNumber++, {faceUp: true}));

	const cardsWithBacks = deckData.mainBoard.filter(card => card.back);

	if (cardsWithBacks.length > 0) {
		deck.ObjectStates.push(createPile(cardsWithBacks, pileNumber++, {faceUp: true, useBack: true}));

	}


	return deck;
}

console.log(JSON.stringify(convertToTableTop(deckSnapshot)));
