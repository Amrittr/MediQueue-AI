import React, { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { MdClose } from "react-icons/md";

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const scanner = new Html5QrcodeScanner("qr-reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    });

    scanner.render(
      (decodedText) => {
        onScanSuccess(decodedText);
        scanner.clear().catch(err => console.error("Error clearing scanner", err));
        onClose();
      },
      (errorMessage) => {
        // Suppress logs for continuous frames scan fails
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.log("Cleanup scanner error", err));
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden relative border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 text-base">Scan Patient QR Code</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <MdClose size={22} />
          </button>
        </div>

        <div className="p-6">
          <div id="qr-reader" className="w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-200"></div>
          <p className="text-xs text-gray-500 text-center mt-4">
            Position the patient's ID QR code within the highlighted scanner box to trigger automatic check-in.
          </p>
        </div>
      </div>
    </div>
  );
}
