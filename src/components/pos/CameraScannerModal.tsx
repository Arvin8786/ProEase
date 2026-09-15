import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { soundEffects } from '../../lib/audio';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        startBarcodeDetection();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasCamera(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in browser settings or use manual/hardware barcode scanner.'
          : 'Unable to connect to video stream. Ensure camera is plugged in.'
      );
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const startBarcodeDetection = () => {
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    let detector: any = null;

    if (BarcodeDetectorClass) {
      try {
        detector = new BarcodeDetectorClass({
          formats: [
            'code_128',
            'code_39',
            'ean_13',
            'ean_8',
            'upc_a',
            'upc_e',
            'qr_code',
            'data_matrix',
          ],
        });
      } catch (e) {
        console.warn('BarcodeDetector initialization warning', e);
      }
    }

    let isScanningFrame = false;

    const detectFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      if (detector && !isScanningFrame) {
        isScanningFrame = true;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue && rawValue !== lastScanned) {
              soundEffects.playScanBeep();
              setLastScanned(rawValue);
              onScan(rawValue);
              // Pause slightly to avoid multiple instant rapid fires
              setTimeout(() => {
                setLastScanned(null);
              }, 1200);
            }
          }
        } catch {
          // ignore detection frames error
        } finally {
          isScanningFrame = false;
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    animationFrameRef.current = requestAnimationFrame(detectFrame);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Live Camera Barcode Scanner</h3>
              <p className="text-xs text-slate-400">Aim target at item barcode or QR code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Area */}
        <div className="relative w-full aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-sm text-slate-300 font-medium">{cameraError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={startCamera}
                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry Camera
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Targeting Overlay Crosshair */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-40 border-2 border-dashed border-blue-400/80 rounded-xl shadow-lg bg-blue-500/5">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-500 rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-500 rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-500 rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-500 rounded-br" />

                  {/* Animated laser line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-bounce" />
                </div>
              </div>

              {lastScanned && (
                <div className="absolute bottom-4 left-4 right-4 bg-emerald-600/90 text-white text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Captured: <strong>{lastScanned}</strong></span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Continuous scan active • Sound feedback enabled</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-300 hover:text-white">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
