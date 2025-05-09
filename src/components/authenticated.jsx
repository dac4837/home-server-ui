import React, { useState, useEffect } from "react";
import { useMsal, useAccount, MsalAuthenticationTemplate } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";
import { getMsalInstance, loginRequest } from "../msalconfig";

const MsalAuthError = ({ error }) => {
    return (
        <div className="alert alert-danger" role="alert">
            <strong>Error:</strong> {error.message}
        </div>
    );
};

export default function Authenticated(props) {
    const { instance, accounts, inProgress } = useMsal();
    const account = useAccount(accounts[0] || {});
    const [activeAccount, setActiveAccount] = useState(account);

    useEffect(() => {
        if (account) {
            setActiveAccount(account);
            getMsalInstance().setActiveAccount(account);
        }
    }, [account, instance]);

    return (
        
            <MsalAuthenticationTemplate
                interactionType={InteractionType.Redirect}
                errorComponent={MsalAuthError}
                loadingComponent={<div>Loading...</div>}
                authenticationRequest={loginRequest}
            >
                {props.children}
            </MsalAuthenticationTemplate>
       
    );
}
