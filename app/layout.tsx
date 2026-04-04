import type { Metadata } from "next";
import "./globals.css";
import WalletConnectProvider from "@/components/WalletConnectProvider";
import AuthenticationModal from "@/components/AuthenticationModal";

export const metadata: Metadata = {
  title: "ProvenanceChain — On-Chain Notary",
  description:
    "Certify any document on Hedera's public blockchain. Instant, permanent, and if you need it — completely anonymous. No lawyer. No office. Just the ledger.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthenticationModal>
          <WalletConnectProvider>{children}</WalletConnectProvider>
        </AuthenticationModal>
      </body>
    </html>
  );
}
