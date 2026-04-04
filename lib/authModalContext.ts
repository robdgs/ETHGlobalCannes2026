import { createContext, useContext } from "react";

interface AuthModalContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined,
);

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return context;
}
