import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ClerkProvider } from "@clerk/clerk-react";

// حط المفتاح هنا مباشرة للتجربة الفورية
const PUBLISHABLE_KEY = "pk_test_cmVsYXhpbmctZnJvZy00MTM0LmNsZXJrLmFjY291bnRzLmRldiQ"; 
// (أو حط المفتاح الخاص بك اللي بيبدأ بـ pk_test_...)

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>,
);
