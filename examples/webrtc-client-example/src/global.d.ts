
declare namespace env {
    const SQUAWK_ADDR: string;
    const JWT_TOKEN: string;
}

declare interface Window {
    env: {
        SQUAWK_ADDR: string;
        JWT_TOKEN: string;
    }
}