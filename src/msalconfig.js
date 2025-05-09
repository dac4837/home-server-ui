import { PublicClientApplication } from "@azure/msal-browser";

let msalInstance;

function getMsalInstance() {
    if (!msalInstance) {
        msalInstance = new PublicClientApplication(msalConfig);
        msalInstance.initialize();
    }
    return msalInstance;
}

const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.REACT_APP_TENANT_ID}`,
        redirectUri: process.env.REACT_APP_REDIRECT_URI,
    },
    cache: {
        cacheLocation: "localStorage",
    },
};

const loginRequest = {
    scopes: ["openid", "profile"],
};

async function getAccessToken() {
    const msalResponse = await getMsalInstance().acquireTokenSilent({
        ...loginRequest,
        account: getMsalInstance().getActiveAccount(),
    });
    return msalResponse.accessToken;
}

export { getMsalInstance, getAccessToken, loginRequest };
