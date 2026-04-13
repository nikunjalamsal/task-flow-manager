import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const cryptoWithOptionalRandomUuid = globalThis.crypto as Crypto & { randomUUID?: Crypto["randomUUID"] };

if (cryptoWithOptionalRandomUuid && typeof cryptoWithOptionalRandomUuid.randomUUID !== "function") {
  const fallbackRandomUuid = (() => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const randomNibble = typeof cryptoWithOptionalRandomUuid.getRandomValues === "function"
        ? cryptoWithOptionalRandomUuid.getRandomValues(new Uint8Array(1))[0] & 15
        : Math.floor(Math.random() * 16);
      const value = char === "x" ? randomNibble : (randomNibble & 0x3) | 0x8;
      return value.toString(16);
    });
  }) as Crypto["randomUUID"];

  try {
    Object.defineProperty(cryptoWithOptionalRandomUuid, "randomUUID", {
      value: fallbackRandomUuid,
      configurable: true,
    });
  } catch {
    cryptoWithOptionalRandomUuid.randomUUID = fallbackRandomUuid;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
