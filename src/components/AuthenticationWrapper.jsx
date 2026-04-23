import { useEffect, useState } from 'react';
import { useMsal, MsalAuthenticationTemplate, useAccount } from '@azure/msal-react';
import { loginRequest, getMsalInstance } from '../authConfig';
import { InteractionType } from '@azure/msal-browser';
import LoadingSpinner from './LoadingSpinner';

const ErrorMessage = ({ error }) => (
  <div style={{ color: 'red' }}>
    <h2>Authentication Error</h2>
    <p>{JSON.stringify(error)}</p>
  </div>
);

export default function AuthenticationWrapper(props) {
    const { instance, accounts, inProgress } = useMsal();
    const account = useAccount(accounts[0] || {});
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        if (account) {
            getMsalInstance().setActiveAccount(account);
        }
    }, [account, instance]);

    useEffect(() => {
        if (account && inProgress === 'none') {
            setIsAuthenticated(true);
        }
    }, [account, inProgress])

    return (
        <>
            <MsalAuthenticationTemplate
                interactionType={InteractionType.Redirect}
                authenticationRequest={loginRequest}
                errorComponent={ErrorMessage}
                loadingComponent={LoadingSpinner}
            >
                {isAuthenticated ? (
                    props.children
                ) : (
                    <LoadingSpinner />
                )}
            </MsalAuthenticationTemplate>
        </>)
}