import Authenticated from '../components/authenticated';

export default function Files() {
    return (
        <div className="container">
            <h1 className="text-center">sign</h1>
            <Authenticated>
                <div className="text-center">
                    <h2>Files</h2>
                    <p>Files page content goes here.</p>
                </div>
            </Authenticated>
        </div>)
}