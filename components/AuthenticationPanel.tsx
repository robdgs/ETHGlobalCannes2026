"use client";

/**
 * components/AuthenticationPanel.tsx
 *
 * Example component demonstrating Reown Authentication (SIWX) usage
 * Shows how to:
 *  - Get session account data
 *  - Store custom metadata
 *  - Listen to session changes
 */

import { useEffect, useState } from "react";
import type { ReownAuthentication } from "@reown/appkit-siwx";
import { useAppKitSIWX } from "@reown/appkit-siwx/react";
import { useAppKitAccount } from "@reown/appkit/react";

interface SessionAccount {
  address?: string;
  chainId?: number | string;
  appKitAccount?: {
    metadata?: Record<string, unknown>;
  };
}

export default function AuthenticationPanel() {
  const { address, isConnected } = useAppKitAccount();
  const siwx = useAppKitSIWX<ReownAuthentication>();
  const [sessionAccount, setSessionAccount] = useState<SessionAccount | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Retrieve session account on mount and when siwx changes
  useEffect(() => {
    if (!siwx || !isConnected) {
      setSessionAccount(null);
      return;
    }

    setIsLoading(true);
    siwx
      .getSessionAccount()
      .then((account) => {
        setSessionAccount(account);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to get session account:", err);
        setError("Failed to load session");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [siwx, isConnected]);

  // Listen to session changes
  useEffect(() => {
    if (!siwx) return;

    const unsubscribe = siwx.on("sessionChanged", (session) => {
      console.log("Session changed:", session);
      if (session) {
        setSessionAccount({
          address: (session as any).address,
          chainId: (session as any).chainId,
        });
      } else {
        setSessionAccount(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [siwx]);

  // Store metadata (e.g., user preferences, app-specific data)
  const updateMetadata = async () => {
    if (!siwx) return;

    try {
      setIsLoading(true);
      await siwx.setSessionAccountMetadata({
        username: "user_" + address?.slice(2, 8),
        lastUpdated: new Date().toISOString(),
        preferences: {
          theme: "dark",
          notifications: true,
        },
      });

      // Refresh session account after updating metadata
      const updated = await siwx.getSessionAccount();
      setSessionAccount(updated);
      setError(null);
    } catch (err) {
      console.error("Failed to update metadata:", err);
      setError("Failed to update metadata");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
        <p className="text-sm text-gray-400">
          Connect wallet to view authentication info
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
        <h3 className="mb-3 font-semibold text-white">Authentication Status</h3>

        {isLoading && <p className="text-sm text-yellow-400">Loading...</p>}

        {error && (
          <p className="rounded bg-red-900/30 p-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {sessionAccount && !isLoading && (
          <div className="space-y-2 text-sm text-gray-300">
            <div>
              <span className="text-gray-400">Address:</span>{" "}
              {sessionAccount.address || "N/A"}
            </div>
            <div>
              <span className="text-gray-400">Chain ID:</span>{" "}
              {sessionAccount.chainId || "N/A"}
            </div>
            {sessionAccount.appKitAccount?.metadata && (
              <div>
                <span className="text-gray-400">Metadata:</span>
                <pre className="mt-1 overflow-auto rounded bg-gray-800 p-2 text-xs">
                  {JSON.stringify(
                    sessionAccount.appKitAccount.metadata,
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </div>
        )}

        <button
          onClick={updateMetadata}
          disabled={isLoading || !siwx}
          className="mt-4 rounded bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-50 hover:bg-purple-700"
        >
          Update Metadata
        </button>
      </div>
    </div>
  );
}
