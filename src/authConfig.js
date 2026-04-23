// Frontend MSAL Configuration

import { PublicClientApplication } from "@azure/msal-browser";

const BASE_URL = window.location.hostname === 'localhost' ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}` : `${window.location.protocol}//${window.location.hostname}`;
const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
const SCOPE = process.env.REACT_APP_SCOPE;
const AUTHORITY = "https://login.microsoftonline.com/consumers"

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: AUTHORITY,
    redirectUri: `${BASE_URL}/auth_callback`,
    navigateToLoginRequestUrl: true
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,
    secureCookies: true
  },
  system: {
    allowNativeBroker: false,
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case "error":
            console.error(message);
            return;
          case "warning":
            console.warn(message);
            return;
          case "info":
            console.info(message);
            return;
          case "verbose":
            console.debug(message);
            return;
          default:
            return;
        }
      }
    }
  }
};

export const tokenRequest = {
  scopes: [`api://${CLIENT_ID}/${SCOPE}`],
  forceRefresh: false
};

export const loginRequest = tokenRequest;

let msalInstance

export function getMsalInstance() {
    if (!msalInstance) {
        msalInstance = new PublicClientApplication(msalConfig)
        msalInstance.initialize()
    }
    return msalInstance
}

export async function getUserAccessToken() {
    const activeAccount = getMsalInstance().getActiveAccount()
    if(!activeAccount) {
        throw new Error("Error getting auth session")
    }

    try {
        const msalResponse = await getMsalInstance().acquireTokenSilent({
            ...tokenRequest,
            account: activeAccount,
            promptInteraction: "ifNeeded"
        })
        return msalResponse.accessToken
    } catch (error) {
        console.error('Token acquisition failed:', error)
        throw error
    }
}