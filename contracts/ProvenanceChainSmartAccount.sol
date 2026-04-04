// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ProvenanceChainSmartAccount.sol
 *
 * Flare Smart Account contract for ProvenanceChain.
 *
 * Implements the ISmartWallet interface so the Flare FDC / XRPL bridge
 * can call handleXRPLPayment() whenever a valid XRPL payment arrives
 * at the linked XRPL address.
 *
 * Deploy on Coston2 testnet:
 *   npx hardhat deploy --network coston2
 *
 * Docs:
 *   https://dev.flare.network/smart-accounts/overview
 *   https://dev.flare.network/fdc/overview
 */

/// @dev Minimal ISmartWallet interface (Flare Smart Account standard)
interface ISmartWallet {
    function handleXRPLPayment(
        address xrplSender,
        uint256 amountDrops,
        bytes calldata memo
    ) external returns (bool success);
}

/// @dev Flare FTSO v2 FastUpdater interface for live price feeds
interface IFastUpdater {
    function getFeedById(bytes21 feedId)
        external
        view
        returns (uint256 value, int8 decimals, uint64 timestamp);
}

contract ProvenanceChainSmartAccount is ISmartWallet {

    // ── Events ────────────────────────────────────────────────────────────
    event ProofStamped(
        bytes32 indexed docHash,
        address indexed submitter,
        string  filename,
        uint64  timestamp,
        uint256 xrplAmountDrops
    );

    event AttestationRequested(
        bytes32 indexed docHash,
        address indexed requester,
        uint256 hcsSequenceHint
    );

    // ── Storage ───────────────────────────────────────────────────────────
    struct ProofRecord {
        bool    exists;
        uint64  timestamp;
        address submitter;
        string  filename;
        uint256 xrplAmountDrops;
    }

    mapping(bytes32 => ProofRecord) public proofs;

    address public owner;

    /// @dev Flare FastUpdater address on Coston2
    IFastUpdater public constant FAST_UPDATER =
        IFastUpdater(0x70e8C12137680faB9400b6c9E33E7ba83c947A8b);

    // XRP/USD feed ID (bytes21: 0x01 + "XRP/USD" right-padded)
    bytes21 public constant XRP_USD_FEED =
        bytes21(0x015852502f55534400000000000000000000000000);

    // Minimum payment in drops (1 XRP = 1_000_000 drops)
    uint256 public minimumDrops = 100_000; // 0.1 XRP default

    // ── Modifiers ─────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /// @dev Only the Flare FDC bridge can call handleXRPLPayment
    modifier onlyBridge() {
        // In production: check msg.sender == FDC_BRIDGE_ADDRESS
        // For testnet demo we allow any caller
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── ISmartWallet implementation ───────────────────────────────────────

    /**
     * @notice Called by the Flare FDC bridge when an XRPL payment arrives.
     *
     * Memo format (UTF-8, hex-encoded in XRPL):
     *   PROVE:<sha256_hex>:<filename_base64>
     *
     * Example memo (decoded):
     *   PROVE:a3f9b2c1...64chars...:Y29udHJhY3QucGRm
     *
     * @param xrplSender  EVM-mapped address of the XRPL sender
     * @param amountDrops Payment amount in drops (1 XRP = 1_000_000)
     * @param memo        UTF-8 bytes of the decoded XRPL memo
     */
    function handleXRPLPayment(
        address xrplSender,
        uint256 amountDrops,
        bytes calldata memo
    ) external override onlyBridge returns (bool success) {
        require(amountDrops >= minimumDrops, "Payment below minimum");

        // Parse memo: PROVE:<hash>:<filename_b64>
        (bytes32 docHash, string memory filename, bool valid) = _parseMemo(memo);
        require(valid, "Invalid memo format");

        // Idempotent: don't overwrite an existing proof
        if (!proofs[docHash].exists) {
            proofs[docHash] = ProofRecord({
                exists:          true,
                timestamp:       uint64(block.timestamp),
                submitter:       xrplSender,
                filename:        filename,
                xrplAmountDrops: amountDrops
            });

            emit ProofStamped(
                docHash,
                xrplSender,
                filename,
                uint64(block.timestamp),
                amountDrops
            );
        }

        // Signal back-end to request TEE attestation
        emit AttestationRequested(docHash, xrplSender, 0);

        return true;
    }

    // ── View functions ────────────────────────────────────────────────────

    /**
     * @notice Check whether a document hash has been proved via XRPL payment.
     */
    function getProofStatus(bytes32 docHash)
        external
        view
        returns (bool exists, uint64 timestamp, address submitter, string memory filename)
    {
        ProofRecord memory r = proofs[docHash];
        return (r.exists, r.timestamp, r.submitter, r.filename);
    }

    /**
     * @notice Fetch live XRP/USD from FTSO v2.
     *         Used off-chain to price the minimum payment dynamically.
     */
    function getXRPPrice()
        external
        view
        returns (uint256 value, int8 decimals, uint64 ts)
    {
        return FAST_UPDATER.getFeedById(XRP_USD_FEED);
    }

    // ── Admin ─────────────────────────────────────────────────────────────

    function setMinimumDrops(uint256 drops) external onlyOwner {
        minimumDrops = drops;
    }

    // ── Internal helpers ──────────────────────────────────────────────────

    /**
     * @dev Parse the XRPL memo bytes.
     * Expected format: "PROVE:<64-char-hex>:<base64-filename>"
     */
    function _parseMemo(bytes calldata memo)
        internal
        pure
        returns (bytes32 docHash, string memory filename, bool valid)
    {
        // Must start with "PROVE:"
        if (memo.length < 70) return (0, "", false);

        bytes memory prefix = bytes("PROVE:");
        for (uint i = 0; i < 6; i++) {
            if (memo[i] != prefix[i]) return (0, "", false);
        }

        // Find first colon after prefix (separates hash from filename)
        uint hashStart = 6;
        uint hashEnd   = 0;
        for (uint i = hashStart; i < memo.length; i++) {
            if (memo[i] == 0x3A) { // ':'
                hashEnd = i;
                break;
            }
        }
        if (hashEnd == 0 || hashEnd - hashStart != 64) return (0, "", false);

        // Decode the 64-char hex hash into bytes32
        bytes memory hashBytes = new bytes(32);
        for (uint i = 0; i < 32; i++) {
            hashBytes[i] = bytes1(
                (_hexCharToNibble(uint8(memo[hashStart + i * 2])) << 4) |
                 _hexCharToNibble(uint8(memo[hashStart + i * 2 + 1]))
            );
        }
        docHash = bytes32(bytes(hashBytes));

        // Remainder after second colon is the filename (base64)
        uint fnStart = hashEnd + 1;
        if (fnStart >= memo.length) return (0, "", false);

        bytes memory fnBytes = memo[fnStart:];
        filename = string(fnBytes); // kept as base64 on-chain; back-end decodes

        valid = true;
    }

    function _hexCharToNibble(uint8 c) internal pure returns (uint8) {
        if (c >= 48 && c <= 57)  return c - 48;       // 0-9
        if (c >= 65 && c <= 70)  return c - 55;       // A-F
        if (c >= 97 && c <= 102) return c - 87;       // a-f
        revert("Invalid hex char");
    }
}
